import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, User } from 'lucide-react';
import { getPublicProfile, type PublicProfile } from '../api/profiles';
import { ApiError } from '../api/client';
import { languageTone } from '../lib/languageColors';

type PublicProfileViewProps = {
  userId: number;
  onBack: () => void;
  getInitials: (name: string) => string;
};

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({
  userId,
  onBack,
  getInitials,
}) => {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicProfile(userId);
        if (!cancelled) setProfile(data);
      } catch (err) {
        if (!cancelled) {
          setProfile(null);
          setError(
            err instanceof ApiError ? err.detail : "Couldn't load this profile."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const name = profile?.user?.name || 'Developer';
  const interests = profile?.interests || [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg transition-colors duration-200 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="w-5 h-5 text-fg-subtle animate-spin" />
            <p className="mono-label">Loading profile…</p>
          </div>
        )}

        {!loading && error && (
          <div className="glass rounded-[18px] p-8 text-center">
            <p className="text-[14px] text-fg-muted mb-4">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="text-[13px] text-accent hover:underline"
            >
              Go back
            </button>
          </div>
        )}

        {!loading && !error && profile && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/12 flex-shrink-0 bg-white/5 flex items-center justify-center">
                {profile.image ? (
                  <img
                    src={profile.image}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="display text-[18px] text-fg-muted">
                    {getInitials(name)}
                  </span>
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <h1 className="display text-[28px] md:text-[32px] text-fg leading-tight truncate">
                  {name}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-fg-subtle">
                  {profile.age != null && <span>{profile.age}</span>}
                  {profile.looking_for && (
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {profile.looking_for}
                    </span>
                  )}
                  {profile.distance && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {profile.distance}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {profile.bio ? (
              <p className="text-[15px] text-fg-muted leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            ) : (
              <p className="text-[14px] text-fg-subtle italic">No bio yet.</p>
            )}

            {interests.length > 0 && (
              <div>
                <p className="mono-label mb-2.5">Stack / interests</p>
                <div className="flex flex-wrap gap-2">
                  {interests.map((tag) => {
                    const tone = languageTone(tag);
                    return (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md text-[12px] border"
                        style={{
                          backgroundColor: tone.bg,
                          borderColor: tone.border,
                          color: tone.text,
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
