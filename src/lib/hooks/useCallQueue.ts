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
                    score,
                    deal_fields (
                        value,
                        field_definitions (
                            key
                        )
                    )
                )
            `).eq('published', true).eq('call_status', 'pending');
            if (error) throw error;
            return data;
        }
    });
};
