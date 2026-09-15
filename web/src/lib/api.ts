// ==============================================
// API Client Helper
// ==============================================

import type { ApiError } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

export class ApiClientError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'Unknown Error',
      message: 'An unexpected error occurred',
      statusCode: response.status,
    }));
    
    throw new ApiClientError(error.message, error.statusCode);
  }
  
  return response.json();
}

export const api = {
  get: async <T>(path: string, token?: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    
    return handleResponse<T>(response);
  },
  
  post: async <T>(path: string, data: any, token?: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });
    
    return handleResponse<T>(response);
  },
  
  patch: async <T>(path: string, data: any, token?: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(data),
    });
    
    return handleResponse<T>(response);
  },
  
  delete: async <T>(path: string, token?: string): Promise<T> => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    
    return handleResponse<T>(response);
  },
};
