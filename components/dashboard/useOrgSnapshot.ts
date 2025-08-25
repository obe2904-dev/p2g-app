'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type OrgSnapshot = { orgName: string; website: string; city: string };

export function useOrgSnapshot() {
  const [org, setOrg] = useState<OrgSnapshot>({ orgName: 'Din virksomhed', website: '', city: '' });

  useEffect(() => {
    (async () => {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('default_org_id')
          .maybeSingle();

        let orgName = 'Din virksomhed';
        let website = '';
        let city = '';

        if (prof?.default_org_id) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('name, city, website')
            .eq('id', prof.default_org_id)
            .maybeSingle();
          if (orgRow?.name) orgName = orgRow.name;
          if (orgRow?.website) website = orgRow.website;
          if (orgRow?.city) city = orgRow.city;
        }

        if (!website) {
          const { data: brand } = await supabase
            .from('brand_sources')
            .select('origin')
            .eq('kind', 'website')
            .limit(1);
          if (brand && brand[0]?.origin) website = brand[0].origin;
        }

        setOrg({ orgName, website, city });
      } catch {
        // stille fallback
      }
    })();
  }, []);

  return org;
}
