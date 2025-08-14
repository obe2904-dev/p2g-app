'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Post = {
  id: number;
  title: string | null;
  body: string;
  image_url: string | null;
  user_email: string | null;
  created_at: string;
}

export default function PostsList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts_app')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) setError(error.message);
      else setPosts(data || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      <h2>Dine opslag</h2>
      {loading && <p>Henter...</p>}
      {error && <p>Fejl: {error}</p>}
      <ul>
        {posts.map(p => (
          <li key={p.id} style={{ marginBottom: 12 }}>
            <div><strong>{p.title ?? '(ingen titel)'}</strong> <small>#{p.id}</small></div>
            <div>{p.body}</div>
            {p.image_url && <div><img src={p.image_url} alt="" style={{ maxWidth: 360 }}/></div>}
            <div><small>Oprettet: {new Date(p.created_at).toLocaleString()}</small></div>
          </li>
        ))}
      </ul>
    </main>
  );
}
