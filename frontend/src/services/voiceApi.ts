import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export const startVoiceRegistration = async (language: string) => {
  // Must use POST to match backend
  const response = await axios.post(`${API_BASE}/api/voice/start`, { language });
  return response.data;
};

export const sendVoiceRegistrationTurn = async (data: {
  session_id: string;
  language: string;
  current_field: string;
  transcript: string;
  farm_state: any;
}) => {
  // Must use POST to match backend
  const response = await axios.post(`${API_BASE}/api/voice/turn`, data);
  return response.data;
};