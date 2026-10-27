"use client";
import { useState, useEffect } from "react";
import { Search, MoreVertical, Share2, Eye, User, Bookmark, HeartCrack, Award } from "lucide-react";
import { supabase } from "../lib/supabase";
import Link from "next/link"; 
import { useRouter } from "next/navigation";


// Views ko K, M mein format karne ka function (Smart Algorithmic Boost Logic)
function formatFakeViews(realReads: number) {
  let displayViews = 0;
  
  if (realReads === 0 || !realReads) {
    displayViews = 0; // Upload karte hi 0 dikhega, ekdum genuine
  } else if (realReads <= 10) {
    displayViews = realReads * 4 + 3; // 1 asli read = 7 views, 10 reads = 43 views
  } else if (realReads <= 50) {
    displayViews = realReads * 7 + 12; // 11 asli reads = 89 views
  } else {
    displayViews = realReads * 12 + 45; // 50+ asli reads = 600+ views (Viral effect)
  }
  
  if (displayViews >= 1_000_000) return `${(displayViews / 1_000_000).toFixed(1)}M`;
  if (displayViews >= 1_000) return `${(displayViews / 1_000).toFixed(1)}K`;
  return String(displayViews);
}

// Avatar Component (Same as Read page for consistency)
function Avatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number; }) {
  const style = { width: size, height: size, minWidth: size };
  if (src) return <img src={src} alt={name} style={style} className="rounded-full object-cover bg-gray-200 border border-gray-100" />;
  return (
    <div style={{ ...style, fontSize: size * 0.4 }} className="rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-white font-semibold flex items-center justify-center select-none shadow-sm">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Novels");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Home Page ke 3-Dot Menu ke liye state
  const [activeMenuPost, setActiveMenuPost] = useState<any | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, content, type, title, category, created_at, thumbnail_url, reads, author_id,
          profiles (username, avatar_url)
        `)
        .eq('type', activeTab === "Novels" ? 'episode' : 'text_post')
        .order('created_at', { ascending: false });

      if (!error) {
        const formattedPosts = data?.map(post => {
          const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          return {
            id: post.id,
            title: post.title || "Bina Title Ki Kahani",
            excerpt: post.content,
            author: profile?.username || "Unknown",
            author_id: post.author_id,
            category: post.category || "General",
            imageUrl: post.thumbnail_url || null, 
            realReads: post.reads || 0,
            authorAvatar: profile?.avatar_url || null 
          };
        }) || [];
        setPosts(formattedPosts);
      }
      setLoading(false);
    }
    fetchPosts();
  }, [activeTab]);

  const handleShare = async () => {
    if (!activeMenuPost) return;
    const url = typeof window !== "undefined" ? `${window.location.origin}/read?id=${activeMenuPost.id}` : "";
    try {
      if (navigator.share) await navigator.share({ title: `Read ${activeMenuPost.title} on Losboi`, url });
      else { await navigator.clipboard.writeText(url); alert("Story link copied!"); }
    } catch (e) {}
    setActiveMenuPost(null);
  };

  const handleViewProfile = () => {
    if (activeMenuPost?.author_id) {
      router.push(`/profile?id=${activeMenuPost.author_id}`);
    }
    setActiveMenuPost(null);
  };

  const handleComingSoon = (featureName: string) => {
    alert(`${featureName} abhi ban raha hai! (Coming Soon)`);
    setActiveMenuPost(null);
  };

  return (
    <div className="bg-white min-h-screen pb-24 font-sans relative">
      <header className="flex justify-between items-center px-4 pt-5 pb-3">
        {/* BRAND NAME UPDATED TO LOSBOI */}
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-serif italic">Losboi</h1>
        
        {/* RANKING/LEVEL SYMBOL */}
        <div className="flex items-center gap-1.5 text-gray-700 text-xs font-bold px-3 py-1.5 bg-gray-50 rounded-full border border-gray-200 shadow-sm cursor-pointer active:scale-95 transition">
          <Award size={14} className="text-amber-500" />
          <span>Novice</span>
        </div>
      </header>

      <div className="flex border-b border-gray-100 mx-4 mb-5">
        <button onClick={() => setActiveTab("Novels")} className={`flex-1 py-3 text-sm font-semibold text-center transition-all ${activeTab === "Novels" ? "text-black border-b-2 border-black" : "text-gray-400"}`}>Novels</button>
        <button onClick={() => setActiveTab("Chats")} className={`flex-1 py-3 text-sm font-semibold text-center transition-all ${activeTab === "Chats" ? "text-black border-b-2 border-black" : "text-gray-400"}`}>Chats</button>
      </div>

      <div className="px-4 flex flex-col gap-8">
        {loading ? (
          <div className="flex justify-center mt-10"><div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full"></div></div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center mt-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><Search className="text-gray-300" size={32} /></div>
            <p className="text-gray-800 font-bold text-lg">Abhi yahan kuch nahi hai</p>
          </div>
        ) : (
          posts.map((post) => (
            <Link href={`/read?id=${post.id}`} key={post.id} className="flex flex-col bg-white mb-2 pb-6 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition block cursor-pointer group">
              
              {/* THUMBNAIL SIZE FIXED BACK TO 16:9 */}
              <div className="w-full aspect-video relative mb-3 overflow-hidden rounded-xl shadow-sm border border-gray-100 bg-gray-100">
                <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm z-10">{post.category}</span>
                {post.imageUrl ? (
                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center p-6">
                        <span className="text-white font-serif text-2xl text-center line-clamp-3 opacity-80">{post.title}</span>
                    </div>
                )}
              </div>

              <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2 line-clamp-2 px-1">{post.title}</h2>
              <p className="text-gray-600 text-sm leading-relaxed line-clamp-2 mb-4 px-1">{post.excerpt}</p>

              <div className="flex items-center justify-between px-1 mt-1">
                <div className="flex items-center gap-2">
                  <Avatar src={post.authorAvatar} name={post.author} size={32} />
                  <span className="text-sm font-bold text-gray-800">@{post.author}</span>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Eye size={12}/> {formatFakeViews(post.realReads)}</span>
                </div>
                
                {/* 3-DOT MENU BUTTON (Always visible now, follow button removed from here) */}
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuPost(post); }} className="p-2 text-gray-400 hover:text-gray-800 active:bg-gray-100 rounded-full transition">
                  <MoreVertical size={20} />
                </button>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* --- Home Page Action Menu Sheet --- */}
      <div className={`fixed inset-0 z-50 ${activeMenuPost ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!activeMenuPost}>
        <div onClick={() => setActiveMenuPost(null)} className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${activeMenuPost ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 bg-white shadow-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out ${activeMenuPost ? "translate-y-0" : "translate-y-full"}`} style={{ borderRadius: "24px 24px 0 0" }}>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" />
          <div className="flex flex-col">
            
            {/* View Profile */}
            <button onClick={handleViewProfile} className="w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold text-gray-900 active:bg-gray-100 flex items-center gap-3">
                <User size={18} className="text-gray-500" /> View Author Profile
            </button>
            
            {/* Share */}
            <button onClick={handleShare} className="w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold text-gray-900 active:bg-gray-100 flex items-center gap-3">
                <Share2 size={18} className="text-gray-500" /> Share Everywhere
            </button>
            
            <div className="h-px bg-gray-100 my-1 w-full" />
            
            {/* Save to Library (Coming Soon) */}
            <button onClick={() => handleComingSoon("Save to Library")} className="w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold text-gray-900 active:bg-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-3">
                    <Bookmark size={18} className="text-gray-500" /> Save to Library
                </div>
                <span className="text-[10px] text-gray-400 font-medium ml-8 -mt-1 uppercase tracking-wider">Coming Soon</span>
            </button>

            {/* Not Interested (Coming Soon) */}
            <button onClick={() => handleComingSoon("Not Interested")} className="w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold text-gray-900 active:bg-gray-100 flex flex-col justify-center">
                <div className="flex items-center gap-3">
                    <HeartCrack size={18} className="text-gray-500" /> Not Interested
                </div>
                <span className="text-[10px] text-gray-400 font-medium ml-8 -mt-1 uppercase tracking-wider">Coming Soon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}