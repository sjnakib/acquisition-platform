'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export const useCallQueue = () => {
    const supabase = createClient();
    return useQuery({
        queryKey: ['call_briefs'],
        queryFn: async () => {
            const { data, error } = await supabase.from('call_briefs').select(`
                *,
                deals (
                    deal_name,
                    property_type,
                    unit_count
                )
            `).eq('published', true).eq('call_status', 'pending');
            if (error) throw error;
            return data;
        }
    });
};
