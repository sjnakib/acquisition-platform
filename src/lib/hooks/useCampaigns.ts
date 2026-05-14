'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export const useCampaigns = () => {
    const supabase = createClient();
    return useQuery({
        queryKey: ['campaigns'],
        queryFn: async () => {
            const { data, error } = await supabase.from('campaigns').select('*');
            if (error) throw error;
            return data;
        }
    });
};
