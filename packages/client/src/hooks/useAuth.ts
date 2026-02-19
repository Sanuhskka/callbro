import { useAuth as useAuthContext, AuthContextType } from '../contexts/AuthContext';

// Re-export the useAuth hook from context for easier importing
export const useAuth: () => AuthContextType = useAuthContext;
