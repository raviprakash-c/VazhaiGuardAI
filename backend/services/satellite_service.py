from __future__
import math, os
from datetime import datetime, timedelta, timezone
from typing import Any
import requests

STAC='https://stac.dataspace.copernicus.eu/v1/search'
TOKEN='https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
PROCESS='https://sh.dataspace.copernicus.eu/process/v1'
STATS='https://sh.dataspace.copernicus.eu/statistics/v1'
COLLECTION='sentinel-2-l2a'
TIMEOUT=float(os.getenv('VAZHAIGUARD_CDSE_TIMEOUT_SECONDS','45'))
CLOUD=float(os.getenv('VAZHAIGUARD_SATELLITE_MAX_CLOUD_PERCENT','35'))
class CDSEConfigurationError(RuntimeError): pass

def _num(v:Any):
    try:return None if v is None else float(v)
    except (TypeError,ValueError):return None

def _clamp(v,lo=0.,hi=1.):return max(lo,min(hi,v))

def _geometry(boundary,lat,lon):
    b=boundary or {}
    if b.get('type')=='Feature': b=b.get('geometry') or {}
    if b.get('type')=='FeatureCollection':
        gs=[x.get('geometry') for x in b.get('features',[]) if isinstance(x,dict) and isinstance(x.get('geometry'),dict)]
        if len(gs)==1:b=gs[0]
        elif gs:b={'type':'GeometryCollection','geometries':gs}
    if isinstance(b,dict) and b.get('type') in {'Polygon','MultiPolygon'} and b.get('coordinates'):
        return b,f"farmer-confirmed {b['type']} boundary",True
    dlat=60/111320; dlon=60/max(1,111320*abs(math.cos(math.radians(lat))))
    return {'type':'Polygon','coordinates':[[[lon-dlon,lat-dlat],[lon+dlon,lat-dlat],[lon+dlon,lat+dlat],[lon-dlon,lat+dlat],[lon-dlon,lat-dlat]]]},'60 m farm-location buffer',False

def _bbox(g):
    pts=[]
    def walk(x):
        if isinstance(x,(list,tuple)):
            if len(x)>=2 and isinstance(x[0],(int,float)) and isinstance(x[1],(int,float)):pts.append((float(x[0]),float(x[1])))
            else:
                for y in x:walk(y)
        elif isinstance(x,dict):
            walk(x.get('coordinates'))
            for y in x.get('geometries',[]):walk(y)
    walk(g)
    if not pts:raise ValueError('Farm boundary contains no valid coordinates.')
    xs,ys=zip(*pts);return [min(xs),min(ys),max(xs),max(ys)]

def _token():
    cid,sec=os.getenv('CDSE_CLIENT_ID'),os.getenv('CDSE_CLIENT_SECRET')
    if not cid or not sec:raise CDSEConfigurationError('Copernicus Data Space credentials are not configured. Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET.')
    r=requests.post(TOKEN,data={'grant_type':'client_credentials','client_id':cid,'client_secret':sec},timeout=TIMEOUT)
    if r.status_code>=400:raise RuntimeError(f'Copernicus authentication failed ({r.status_code}).')
    t=r.json().get('access_token')
    if not t:raise RuntimeError('Copernicus authentication response did not contain an access token.')
    return t

def _search(g,start,end,cloud,limit=20):
    z=lambda d:d.isoformat().replace('+00:00','Z')
    p={'collections':[COLLECTION],'datetime':f'{z(start)}/{z(end)}','intersects':g,'query':{'eo:cloud_cover':{'lte':cloud}},'sortby':[{'field':'datetime','direction':'desc'}],'limit':limit}
    r=requests.post(STAC,json=p,timeout=TIMEOUT)
    if r.status_code>=400:raise RuntimeError(f'Copernicus STAC search failed ({r.status_code}).')
    return r.json().get('features',[])

def _scene_time(s):
    raw=s.get('properties',{}).get('datetime') or s.get('properties',{}).get('start_datetime')
    if not raw:raise RuntimeError('Copernicus scene has no acquisition timestamp.')
    return datetime.fromisoformat(raw.replace('Z','+00:00')).astimezone(timezone.utc)

EVAL=r'''//VERSION=3
function setup(){return{input:[{bands:["B04","B05","B08","B8A","B03","SCL","dataMask"]}],output:[{id:"indices",bands:3,sampleType:"FLOAT32"},{id:"dataMask",bands:1,sampleType:"UINT8"}]};}
function evaluatePixel(s){var c=[3,8,9,10,11].includes(s.SCL);var a=s.B08+s.B04,b=s.B8A+s.B05,d=s.B03+s.B08;var n=a===0?0:(s.B08-s.B04)/a;var r=b===0?0:(s.B8A-s.B05)/b;var w=d===0?0:(s.B03-s.B08)/d;return{indices:[n,r,w],dataMask:[s.dataMask*(c?0:1)]};}
'''
RGB=r'''//VERSION=3
function setup(){return{input:[{bands:["B02","B03","B04","SCL","dataMask"]}],output:{bands:3,sampleType:"AUTO"}};}
function evaluatePixel(s){var c=[3,8,9,10,11].includes(s.SCL);if(c||s.dataMask===0)return[0,0,0];return[2.5*s.B04,2.5*s.B03,2.5*s.B02];}
'''

def _stats(token,g,t):
    z=lambda d:d.isoformat().replace('+00:00','Z');a=z(t-timedelta(minutes=3));b=z(t+timedelta(minutes=3))
    p={'input':{'bounds':{'geometry':g},'data':[{'type':COLLECTION,'dataFilter':{'timeRange':{'from':a,'to':b}}}]},'aggregation':{'timeRange':{'from':a,'to':b},'aggregationInterval':{'of':'P1D'},'evalscript':EVAL,'resx':10,'resy':10}}
    r=requests.post(STATS,headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},json=p,timeout=TIMEOUT)
    if r.status_code>=400:raise RuntimeError(f'Copernicus statistics request failed ({r.status_code}).')
    o=(r.json().get('data') or [{}])[0].get('outputs',{}).get('indices',{}).get('bands',{})
    return [_num((o.get(k) or {}).get('stats',{}).get('mean')) for k in ('B0','B1','B2')]

def _satellite_stress(n,r,w):
    if n is None:return None,None
    s=_clamp((.70-n)/.45)*.55+_clamp((.42-(r if r is not None else .42))/.30)*.25+_clamp((.10-(w if w is not None else .10))/.35)*.20
    return round(s*100,1),round(_clamp(.75-.25*_clamp((.70-n)/.45)),3)

def analyze_satellite_evidence(*,latitude,longitude,boundary=None,lookback_days=45,baseline_days=45,max_cloud_percent=CLOUD):
    if not -90<=latitude<=90 or not -180<=longitude<=180:raise ValueError('Invalid farm latitude/longitude.')
    if not 7<=lookback_days<=180:raise ValueError('lookback_days must be between 7 and 180.')
    if not 7<=baseline_days<=180:raise ValueError('baseline_days must be between 7 and 180.')
    if not 0<=max_cloud_percent<=100:raise ValueError('max_cloud_percent must be between 0 and 100.')
    g,scope,confirmed=_geometry(boundary,latitude,longitude);now=datetime.now(timezone.utc);rs=now-timedelta(days=lookback_days);bs=rs-timedelta(days=baseline_days)
    recent=_search(g,rs,now,max_cloud_percent);base=_search(g,bs,rs,max_cloud_percent)
    if not recent:return {'available':False,'provider':'Copernicus Data Space Ecosystem','source':'Copernicus Sentinel-2 Level-2A','datasets':{'sentinel2':COLLECTION},'analysis_scope':scope,'reason':'No Sentinel-2 L2A observation passed the date, geometry, and cloud filters.','warnings':['Try a longer lookback window or allow a higher cloud threshold.']}
    token=_token();scene=recent[0];t=_scene_time(scene);v=_stats(token,g,t);bv=_stats(token,g,_scene_time(base[0])) if base else [None,None,None];n,r,w=v;bn=bv[0];trendv=round(n-bn,4) if n is not None and bn is not None else None;trend='insufficient_history' if trendv is None else 'improving' if trendv>=.05 else 'declining' if trendv<=-.05 else 'stable';score,conf=_satellite_stress(n,r,w);age=round(max(0,(now-t).total_seconds()/3600),1);cloud=_num(scene.get('properties',{}).get('eo:cloud_cover'));warn=['Satellite evidence is farm/zone-level context, not individual-tree disease diagnosis.','NDVI/NDRE/NDWI risk is a prototype vegetation-stress heuristic and requires field verification.']
    if age>240:warn.append('The latest usable satellite observation is older than 10 days.')
    if cloud is not None and cloud>25:warn.append('The selected scene has substantial cloud cover; interpret results cautiously.')
    return {'available':True,'provider':'Copernicus Data Space Ecosystem','source':'Copernicus Sentinel-2 Level-2A','datasets':{'sentinel2':COLLECTION},'analysis_scope':scope,'farm_geometry':{'source':scope,'is_farmer_confirmed':confirmed,'geometry_type':g.get('type')},'resolution_m':10,'latest_observation':t.isoformat(),'observed_at':t.isoformat(),'observation_age_hours':age,'image_count':len(recent),'cloud_percent_mean':cloud,'ndvi':n,'ndre':r,'ndwi':w,'baseline_ndvi':bn,'ndvi_trend':trendv,'trend':trend,'crop_state':'vegetation_present' if n is not None and n>=.25 else 'low_or_uncertain_vegetation','health_index':round(1-score/100,3) if score is not None else None,'risk_score':score,'confidence':conf,'risk_method':'prototype vegetation-stress heuristic; not a disease classifier','scene_id':scene.get('id'),'warnings':warn}

def render_true_color_preview(*,latitude,longitude,boundary=None,lookback_days=45,max_cloud_percent=CLOUD):
    g,_,_=_geometry(boundary,latitude,longitude);bbox=_bbox(g);now=datetime.now(timezone.utc)
    try:scene=_search(g,now-timedelta(days=lookback_days),now,max_cloud_percent)[0]
    except IndexError:raise RuntimeError('No suitable Sentinel-2 scene is available for the farm.')
    token=_token();t=_scene_time(scene);z=lambda d:d.isoformat().replace('+00:00','Z');a=z(t-timedelta(minutes=3));b=z(t+timedelta(minutes=3))
    p={'input':{'bounds':{'bbox':bbox,'properties':{'crs':'http://www.opengis.net/def/crs/OGC/1.3/CRS84'}},'data':[{'type':COLLECTION,'dataFilter':{'timeRange':{'from':a,'to':b}}}]},'output':{'width':900,'height':700,'responses':[{'identifier':'default','format':{'type':'image/png'}}]},'evalscript':RGB}
    r=requests.post(PROCESS,headers={'Authorization':f'Bearer {token}','Content-Type':'application/json','Accept':'image/png'},json=p,timeout=TIMEOUT)
    if r.status_code>=400:raise RuntimeError(f'Copernicus image processing failed ({r.status_code}).')
    return r.content,'image/png',[[bbox[1],bbox[0]],[bbox[3],bbox[2]]]

def satellite_configuration_status():return {'configured':bool(os.getenv('CDSE_CLIENT_ID') and os.getenv('CDSE_CLIENT_SECRET')),'provider':'Copernicus Data Space Ecosystem','collection':COLLECTION,'image_resolution_m':10,'satellite_is_live':False,'scope':'farm_or_zone_level'}
