'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export const useAuth = () => {
    const supabase = createClient();
    return useQuery({
        queryKey: ['user'],
        queryFn: async () => {
            const { data, error } = await supabase.auth.getUser();
            if (error) throw error;
            return data.user;
        }
    });
};
