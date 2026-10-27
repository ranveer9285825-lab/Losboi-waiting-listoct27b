"use client";
/* eslint-disable @next/next/no-img-element */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { ShieldAlert, X, Flag, Eye, Heart, Share2, Sun, Moon } from "lucide-react";

/* ------------------------------ Types ------------------------------ */
type Story = {
  id: string;
  title: string;
  content: string;
  thumbnail_url: string | null;
  category: string | null;
  reads: number;
  author_id: string | null;
  username: string;
  avatar_url: string | null;
};

type CommentItem = {
  id: string;
  username: string;
  avatar_url: string | null;
  text: string;
  created_at: string;
  parent_id: string | null;
};

/* ----------------------------- Helpers ----------------------------- */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return "";
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return "abhi";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ghante`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} din`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon} mahine`;
  return `${Math.floor(mon / 12)} saal`;
}

function getFakeViewsNumber(realReads: number) {
  if (realReads === 0 || !realReads) return 0;
  if (realReads <= 10) return realReads * 4 + 3;
  if (realReads <= 50) return realReads * 7 + 12;
  return realReads * 12 + 45;
}

function formatNumber(num: number) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}

function Avatar({ src, name, size }: { src?: string | null; name: string; size: number; }) {
  const style = { width: size, height: size, minWidth: size };
  if (src) {
    return <img src={src} alt={name} style={style} className="rounded-full object-cover bg-gray-200 border border-gray-100" />;
  }
  return (
    <div style={{ ...style, fontSize: size * 0.42 }} className="rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-white font-semibold flex items-center justify-center select-none shadow-sm">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main reader                                                         */
/* ------------------------------------------------------------------ */
function ReadPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);

  const [following, setFollowing] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [storyLiked, setStoryLiked] = useState(false);

  // Sheet States
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSheetOpen, setReportSheetOpen] = useState(false);

  // Reply System States
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ parentId: string; username: string } | null>(null);

  // Report System States
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const [liveIndex, setLiveIndex] = useState(0);
  const readsCounted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const anySheetOpen = commentSheetOpen || menuOpen || reportSheetOpen;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    if (!id) router.replace("/");
  }, [id, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase.from("posts").select("*, profiles(username, avatar_url)").eq("id", id).single();
      if (cancelled) return;

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

      setStory({
        id: String(data.id),
        title: data.title ?? "",
        content: data.content ?? data.body ?? "",
        thumbnail_url: data.thumbnail_url ?? data.cover_url ?? data.image_url ?? null,
        category: data.category ?? null,
        reads: Number(data.reads ?? 0),
        author_id: data.author_id ?? data.user_id ?? null,
        username: profile?.username ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
      });

      if (!readsCounted.current) {
        readsCounted.current = true;
        supabase.rpc("increment_reads", { post_id: data.id }).then(() => {});
      }

      const { data: commentsData } = await supabase
        .from("comments")
        .select("*, profiles(username, avatar_url)")
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      setComments(
        (commentsData ?? []).map((c) => {
          const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
          return {
            id: String(c.id),
            username: p?.username ?? c.username ?? "Reader",
            avatar_url: p?.avatar_url ?? c.avatar_url ?? null,
            text: c.content ?? c.text ?? "",
            created_at: c.created_at ?? new Date().toISOString(),
            parent_id: c.parent_id ? String(c.parent_id) : null,
          };
        })
      );
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  const commentTree = useMemo(() => {
    const main = comments.filter(c => !c.parent_id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const replies = comments.filter(c => c.parent_id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return main.map(m => ({ ...m, replies: replies.filter(r => r.parent_id === m.id) }));
  }, [comments]);

  const liveList = useMemo(() => {
    return commentTree.slice(0, 6).map((c) => ({ username: c.username, text: c.text, avatar_url: c.avatar_url }));
  }, [commentTree]);

  useEffect(() => {
    if (liveList.length < 2) return;
    const t = setInterval(() => { setLiveIndex((i) => (i + 1) % liveList.length); }, 4000);
    return () => clearInterval(t);
  }, [liveList.length]);

  const liveComment = liveList.length > 0 ? liveList[liveIndex % liveList.length] : null;

  useEffect(() => {
    document.body.style.overflow = anySheetOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [anySheetOpen]);

  const handleReplyClick = (parentId: string, username: string) => {
    setReplyingTo({ parentId, username });
    setNewComment(`@${username} `);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment("");
  };

  // ==========================================
  // COMMENT POSTING LOGIC
  // ==========================================
  const handlePost = async () => {
    const text = newComment.trim();
    if (!text || !id || posting) return;
    setPosting(true);

    try {
      // 1. LIVE CHECK: Button dabate hi check karo user logged in hai ya nahi
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user ?? null;

      // Agar login nahi hai, toh rok do
      if (!user) {
        alert("Comment karne ke liye pehle login karein.");
        setPosting(false);
        return;
      }

      // 2. PAYLOAD TAIYAAR KARO
      const payload: Record<string, unknown> = {
        post_id: id,
        content: text,
        parent_id: replyingTo ? replyingTo.parentId : null,
        user_id: user.id
      };

      // 3. DATABASE MEIN SAVE KARO
      const { data, error } = await supabase.from("comments").insert(payload).select().single();

      if (error) {
        showToast("Comment post nahi ho paaya: " + error.message);
        setPosting(false);
        return;
      }

      // 4. USER KI PROFILE FETCH KARO (UI MEIN DIKHANE KE LIYE)
      let username = "You";
      let avatar: string | null = null;

      const { data: prof } = await supabase.from("profiles").select("username, avatar_url").eq("id", user.id).maybeSingle();
      if (prof) {
        username = prof.username || "You";
        avatar = prof.avatar_url || null;
      }

      // 5. NAYA COMMENT STATE MEIN DAALO (TURANT DIKHANE KE LIYE)
      const created: CommentItem = {
        id: String(data?.id ?? `local-${Date.now()}`),
        username,
        avatar_url: avatar,
        text,
        created_at: data?.created_at ?? new Date().toISOString(),
        parent_id: replyingTo ? replyingTo.parentId : null
      };

      setComments((prev) => [...prev, created]);
      setNewComment("");
      setReplyingTo(null);

    } catch (err) {
      showToast("Error: " + errMsg(err));
    } finally {
      setPosting(false);
    }
  };
  // ==========================================

  const handleShare = async () => {
    setMenuOpen(false);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = story?.title ?? "Story on Losboi";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text: title, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast("Link copy ho gaya");
      }
    } catch { }
  };

  const handleViewProfile = () => { setMenuOpen(false); if (story?.author_id) router.push(`/profile?id=${story.author_id}`); };

  const toggleLike = (cid: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
  };

  const handleReportSubmit = async () => {
    if (!reportReason) { alert("Kripya ek kaaran (reason) chunein."); return; }

    // Report ke liye bhi live check
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user ?? null;

    if (!user) {
      alert("Report karne ke liye pehle login karein.");
      return;
    }

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('reports').insert({
        post_id: id,
        reported_by: user.id,
        reason: reportReason,
        description: reportDescription.trim() || null
      });
      if (error) throw error;

      setReportSheetOpen(false);
      setReportReason("");
      setReportDescription("");
      showToast("Aapki report submit ho gayi hai. Shukriya!");
    } catch (err) {
      alert("Report submit nahi ho paayi: " + errMsg(err));
    } finally {
      setSubmittingReport(false);
    }
  };

  if (!id) return <div className="min-h-screen bg-gray-50" />;
  if (loading) return <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex items-center justify-center"><div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-rose-500 animate-spin"/></div>;
  if (notFound || !story) return <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-gray-700">Ye story nahi mili.</p><button onClick={() => router.replace("/")} className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm">Home par jao</button></div>;

  const actualFakeViews = getFakeViewsNumber(story.reads || 0);
  const displayViews = formatNumber(actualFakeViews);
  const baseFakeLikes = actualFakeViews === 0 ? 0 : Math.floor(actualFakeViews * 0.08);
  const displayLikes = formatNumber(baseFakeLikes + (storyLiked ? 1 : 0));

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#121212]' : 'bg-gray-50'}`}>

      <div className={`max-w-md mx-auto min-h-screen relative transition-[filter,background-color] duration-300 ${anySheetOpen ? "blur-sm" : ""} ${isDarkMode ? 'bg-[#121212]' : 'bg-white'}`}>

        <div className="relative w-full aspect-video bg-gray-100 border-b border-gray-100">
          {story.thumbnail_url ? <img src={story.thumbnail_url} alt={story.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-gray-800 via-gray-700 to-rose-900" />}

          <button onClick={() => router.back()} className="absolute top-3 left-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white text-xl flex items-center justify-center active:scale-95 z-20">←</button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md text-white flex items-center justify-center active:scale-95 z-20 transition"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <header className={`sticky top-0 z-40 backdrop-blur-md transition-transform duration-300 ease-in-out ${zenMode ? "-translate-y-full" : "translate-y-0"} ${isDarkMode ? 'bg-[#1a1a1a]/95 border-b border-[#333]' : 'bg-white/95 border-b border-gray-100'}`}>
          <div className="flex items-center gap-3 px-4 py-3">
            <Avatar src={story.avatar_url} name={story.username || "?"} size={40} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{story.username}</p>
              <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{displayViews} views {story.category ? ` • ${story.category}` : ""}</p>
            </div>
            {following ? (
              <button onClick={() => setMenuOpen(true)} className={`h-9 w-9 rounded-full flex items-center justify-center text-xl transition-colors ${isDarkMode ? 'text-gray-300 hover:bg-[#333]' : 'text-gray-700 active:bg-gray-100'}`}>⋮</button>
            ) : (
              <button onClick={() => setFollowing(true)} className="h-9 px-5 rounded-full bg-rose-600 text-white text-sm font-semibold active:scale-95 transition-transform">Follow</button>
            )}
          </div>
        </header>

        <main onClick={() => setZenMode((z) => !z)} className="px-5 pt-6 pb-36 cursor-pointer">
          {story.title && <h1 className={`font-serif text-3xl font-bold leading-tight mb-4 break-words transition-colors ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{story.title}</h1>}

          <div className={`flex items-center gap-6 mb-8 pb-4 border-b cursor-default transition-colors ${isDarkMode ? 'border-[#333]' : 'border-gray-100'}`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center gap-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Eye size={18} />
              <span className="text-sm font-semibold">{displayViews} Views</span>
            </div>
            <button onClick={() => setStoryLiked(!storyLiked)} className={`flex items-center gap-1.5 transition-colors ${storyLiked ? 'text-rose-600' : isDarkMode ? 'text-gray-400 hover:text-rose-500' : 'text-gray-500 hover:text-rose-600 active:scale-95'}`}>
              <Heart size={18} fill={storyLiked ? "currentColor" : "none"} />
              <span className="text-sm font-semibold">{displayLikes} Likes</span>
            </button>
            <button onClick={() => setMenuOpen(true)} className={`ml-auto flex items-center gap-1.5 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-800'}`}>
              <Share2 size={18} />
            </button>
          </div>

          <div className={`font-serif text-[18px] leading-[1.8] whitespace-pre-wrap break-words transition-colors ${isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>
            {story.content}
          </div>
        </main>
      </div>

      {/* Floating Comment Bar */}
      {liveComment && (
        <button onClick={() => setCommentSheetOpen(true)} className={`fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[380px] z-30 rounded-full shadow-lg border px-3 py-2.5 flex items-center gap-3 text-left transition-all duration-300 ease-in-out ${zenMode ? "translate-y-[150%]" : "translate-y-0"} ${isDarkMode ? 'bg-[#222] border-[#333]' : 'bg-white border-gray-200'}`}>
          <Avatar src={liveComment.avatar_url} name={liveComment.username} size={28} />
          <div key={liveIndex} className="flex-1 min-w-0 animate-[fadeIn_0.4s_ease]">
            <p className="text-[13px] leading-tight truncate">
              <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{liveComment.username}</span>
              <span className={`ml-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{liveComment.text}</span>
            </p>
          </div>
        </button>
      )}
      {!liveComment && !zenMode && (
        <button onClick={() => setCommentSheetOpen(true)} className={`fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full shadow-lg border px-5 py-2.5 text-sm font-semibold z-30 transition-all duration-300 ease-in-out ${isDarkMode ? 'bg-[#222] border-[#333] text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
          Pehla comment likhein
        </button>
      )}

      {/* Comment Sheet */}
      <div className={`fixed inset-0 z-50 ${commentSheetOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!commentSheetOpen}>
        <div onClick={() => setCommentSheetOpen(false)} className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${commentSheetOpen ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 h-[80vh] flex flex-col shadow-2xl transition-transform duration-300 ease-out ${commentSheetOpen ? "translate-y-0" : "translate-y-full"} ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`} style={{ borderRadius: "24px 24px 0 0" }}>

          <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${isDarkMode ? 'border-[#333]' : 'border-gray-100'}`}>
            <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Comments ({comments.length})</h2>
            <button onClick={() => setCommentSheetOpen(false)} className={`h-8 w-8 rounded-full flex items-center justify-center text-lg ${isDarkMode ? 'text-gray-400 hover:bg-[#333]' : 'text-gray-600 active:bg-gray-100'}`}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">
            {commentTree.length === 0 ? <p className={`text-center text-sm pt-10 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>Abhi koi comment nahi hai. Pehle aap likho.</p> : (
              commentTree.map((c) => (
                <div key={c.id} className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <Avatar src={c.avatar_url} name={c.username} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2"><span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{c.username}</span><span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span></div>
                      <p className={`text-sm mt-0.5 whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{c.text}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <button onClick={() => toggleLike(c.id)} className={`text-xs font-medium ${likedIds.has(c.id) ? "text-rose-600" : "text-gray-500"}`}>{likedIds.has(c.id) ? "❤️ Liked" : "🤍 Like"}</button>
                        <button onClick={() => handleReplyClick(c.id, c.username)} className="text-xs font-medium text-gray-500">Reply</button>
                      </div>
                    </div>
                  </div>
                  {c.replies && c.replies.length > 0 && (
                    <div className="ml-11 flex flex-col gap-4">
                      {c.replies.map((r) => (
                        <div key={r.id} className="flex gap-3">
                          <Avatar src={r.avatar_url} name={r.username} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2"><span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>{r.username}</span><span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span></div>
                            <p className={`text-sm mt-0.5 whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{r.text.startsWith('@') ? <><span className="text-blue-500 font-medium">{r.text.split(' ')[0]}</span><span>{r.text.substring(r.text.indexOf(' '))}</span></> : r.text}</p>
                            <div className="flex items-center gap-4 mt-1.5">
                              <button onClick={() => toggleLike(r.id)} className={`text-xs font-medium ${likedIds.has(r.id) ? "text-rose-600" : "text-gray-500"}`}>{likedIds.has(r.id) ? "❤️" : "🤍"}</button>
                              <button onClick={() => handleReplyClick(c.id, r.username)} className="text-xs font-medium text-gray-500">Reply</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {replyingTo && (
            <div className={`px-5 py-2 flex justify-between items-center border-t ${isDarkMode ? 'bg-[#222] border-[#333]' : 'bg-gray-100 border-gray-200'}`}>
              <span className="text-xs text-gray-500 font-medium">Replying to <span className={`font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>@{replyingTo.username}</span></span>
              <button onClick={cancelReply} className="text-xs text-gray-500 hover:text-gray-400 font-bold">✕ Cancel</button>
            </div>
          )}

          <div className={`border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2 ${isDarkMode ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-100 bg-white'}`}>
            <input ref={inputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handlePost(); }} placeholder={replyingTo ? "Apna reply likho..." : "Comment likho..."} className={`flex-1 min-w-0 h-11 rounded-full px-4 text-[16px] outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-[#333] text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900'}`} />
            <button onClick={handlePost} disabled={!newComment.trim() || posting} className="h-11 px-5 rounded-full bg-blue-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-transform">{posting ? "..." : "Post"}</button>
          </div>
        </div>
      </div>

      {/* Action Menu Sheet */}
      <div className={`fixed inset-0 z-50 ${menuOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!menuOpen}>
        <div onClick={() => setMenuOpen(false)} className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${menuOpen ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 shadow-2xl px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out ${menuOpen ? "translate-y-0" : "translate-y-full"} ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`} style={{ borderRadius: "24px 24px 0 0" }}>
          <div className={`mx-auto mb-3 h-1.5 w-10 rounded-full ${isDarkMode ? 'bg-[#444]' : 'bg-gray-300'}`} />
          <div className="flex flex-col">
            <button onClick={handleShare} className={`w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold flex items-center gap-3 ${isDarkMode ? 'text-gray-200 active:bg-[#333]' : 'text-gray-900 active:bg-gray-100'}`}>
              <Share2 size={18} className="text-gray-500" /> Share Everywhere
            </button>
            <button onClick={handleViewProfile} className={`w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold flex items-center gap-3 ${isDarkMode ? 'text-gray-200 active:bg-[#333]' : 'text-gray-900 active:bg-gray-100'}`}>
              <Avatar src={story.avatar_url} name={story.username || "?"} size={18} /> View Author Profile
            </button>

            <div className={`h-px my-1 w-full ${isDarkMode ? 'bg-[#333]' : 'bg-gray-100'}`} />

            <button onClick={() => { setMenuOpen(false); setTimeout(() => setReportSheetOpen(true), 300); }} className={`w-full text-left px-3 py-3.5 rounded-xl text-[15px] font-semibold flex items-center justify-between group ${isDarkMode ? 'text-red-500 active:bg-red-950/30' : 'text-red-600 active:bg-red-50'}`}>
              <div className="flex items-center gap-3">
                <Flag size={18} className="text-red-500" /> Report Story
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* DETAILED REPORT Sheet */}
      <div className={`fixed inset-0 z-50 ${reportSheetOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!reportSheetOpen}>
        <div onClick={() => { setReportSheetOpen(false); setReportReason(""); setReportDescription(""); }} className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${reportSheetOpen ? "opacity-100" : "opacity-0"}`} />
        <div className={`absolute bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 shadow-2xl transition-transform duration-300 ease-out ${reportSheetOpen ? "translate-y-0" : "translate-y-full"} ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`} style={{ borderRadius: "24px 24px 0 0", height: "80vh", display: 'flex', flexDirection: 'column' }}>

          <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b shrink-0 ${isDarkMode ? 'border-[#333]' : 'border-gray-100'}`}>
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-red-500" size={20} />
              <h3 className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Report an Issue</h3>
            </div>
            <button onClick={() => { setReportSheetOpen(false); setReportReason(""); setReportDescription(""); }} className={`h-8 w-8 rounded-full flex items-center justify-center transition ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-[#333]' : 'text-gray-500 active:bg-gray-100 hover:text-gray-900'}`}>
              <X size={20} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
            <p className={`text-[13px] mb-4 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Agar aapko lagta hai ki is kahani mein kuch galat hai, toh please humein batayein. Ye report directly hamari team ke paas jayegi aur kisi aur ko nahi dikhegi.
            </p>

            <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-3 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Reason select karein</h4>
            <div className="space-y-2 mb-6">
              {[
                { id: "spam", label: "Spam ya Kachra", desc: "Bar-bar ek hi cheez post karna ya links spam karna." },
                { id: "inappropriate", label: "Galat / Inappropriate Content", desc: "Sexual, violent ya kisi tarah ki gandagi." },
                { id: "copyright", label: "Copy ki gayi kahani (Copyright)", desc: "Kisi aur ki likhi kahani chura kar daalna." },
                { id: "hate", label: "Nafarat failana (Hate Speech)", desc: "Kisi dharam, jaati ya insaan ko target karna." },
                { id: "other", label: "Kuch aur problem hai", desc: "Koi aur samasya jo upar list mein nahi hai." }
              ].map((reason) => (
                <label key={reason.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${reportReason === reason.id ? isDarkMode ? 'border-gray-500 bg-[#333]' : 'border-black bg-gray-50' : isDarkMode ? 'border-[#333] bg-[#222] hover:border-gray-500' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                  <div className="pt-1">
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason.id}
                      checked={reportReason === reason.id}
                      onChange={() => setReportReason(reason.id)}
                      className={`w-4 h-4 cursor-pointer ${isDarkMode ? 'accent-gray-400' : 'accent-black text-black'}`}
                    />
                  </div>
                  <div>
                    <div className={`text-sm font-bold ${reportReason === reason.id ? isDarkMode ? 'text-white' : 'text-black' : isDarkMode ? 'text-gray-300' : 'text-gray-800'}`}>{reason.label}</div>
                    <div className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{reason.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {reportReason && (
              <div className="animate-[fadeIn_0.3s_ease]">
                <h4 className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Thoda Detail Mein Batayein (Optional)</h4>
                <textarea
                  rows={3}
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Kya problem aa rahi hai is kahani ke saath?"
                  className={`w-full border rounded-xl p-3 text-sm outline-none transition resize-none ${isDarkMode ? 'bg-[#222] border-[#333] text-white focus:border-gray-500 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-black'}`}
                />
              </div>
            )}
          </div>

          <div className={`p-4 border-t shrink-0 ${isDarkMode ? 'border-[#333] bg-[#1a1a1a]' : 'border-gray-100 bg-white'}`}>
            <button
              onClick={handleReportSubmit}
              disabled={!reportReason || submittingReport}
              className={`w-full font-bold py-3.5 rounded-xl text-[15px] active:scale-[0.98] transition disabled:opacity-30 disabled:active:scale-100 flex items-center justify-center gap-2 ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}
            >
              {submittingReport ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-sm shadow-lg transition-all duration-300 ${toast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"} ${isDarkMode ? 'bg-gray-100 text-black' : 'bg-gray-900 text-white'}`} role="status">
        {toast}
      </div>

      <style jsx global>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page export (Suspense zaroori hai useSearchParams ke liye)          */
/* ------------------------------------------------------------------ */
export default function ReadPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ReadPageContent />
    </Suspense>
  );
}
