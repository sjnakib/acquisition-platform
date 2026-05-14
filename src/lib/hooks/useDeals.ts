'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export const useDeals = () => {
    const supabase = createClient();
    return useQuery({
        queryKey: ['deals'],
        queryFn: async () => {
            const { data, error } = await supabase.from('deals').select('*');
            if (error) throw error;
            return data;
        }
    });
};
