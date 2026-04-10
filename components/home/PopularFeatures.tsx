/**
 * PopularFeatures - Main component for popular movies section
 * Displays Douban movie recommendations with tag filtering and infinite scroll.
 * Includes personalized "为你推荐" tag when user has 2+ watched items.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { TagManager } from './TagManager';
import { MovieGrid } from './MovieGrid';
import { useTagManager } from './hooks/useTagManager';
import { usePopularMovies } from './hooks/usePopularMovies';
import { usePersonalizedRecommendations } from './hooks/usePersonalizedRecommendations';
import { usePremiumModeEnabled } from '@/lib/hooks/usePremiumModeEnabled';

const PREMIUM_TAG = { id: 'premium-entry', label: '高级', value: '高级' };

interface PopularFeaturesProps {
  onSearch?: (query: string) => void;
}

export function PopularFeatures({ onSearch }: PopularFeaturesProps) {
  const premiumModeEnabled = usePremiumModeEnabled();
  const {
    tags,
    selectedTag,
    contentType,
    newTagInput,
    showTagManager,
    justAddedTag,
    setContentType,
    setSelectedTag,
    setNewTagInput,
    setShowTagManager,
    setJustAddedTag,
    handleAddTag,
    handleDeleteTag,
    handleRestoreDefaults,
    handleDragEnd,
    isLoadingTags,
  } = useTagManager();

  const {
    movies: recommendMovies,
    loading: recommendLoading,
    hasMore: recommendHasMore,
    hasHistory,
    prefetchRef: recommendPrefetchRef,
    loadMoreRef: recommendLoadMoreRef,
  } = usePersonalizedRecommendations(false);

  // Track whether the recommendation tab is active
  const [isRecommendSelected, setIsRecommendSelected] = useState(hasHistory);

  // Sync selection when hasHistory changes after Zustand hydration from localStorage.
  // On first render the store is empty (hasHistory=false), so useState captures false.
  // Once hydration completes and hasHistory becomes true, auto-select the recommendation tab.
  useEffect(() => {
    if (hasHistory) {
      setIsRecommendSelected(true);
    }
  }, [hasHistory]);

  const effectiveRecommendSelected = hasHistory && isRecommendSelected;

  const {
    movies,
    loading,
    hasMore,
    prefetchRef,
    loadMoreRef,
  } = usePopularMovies(
    effectiveRecommendSelected ? '' : selectedTag,
    tags,
    contentType
  );

  const displayTags = useMemo(() => {
    const filteredTags = tags.filter((tag) => tag.label !== '高级' && tag.id !== PREMIUM_TAG.id);
    return premiumModeEnabled ? [PREMIUM_TAG, ...filteredTags] : filteredTags;
  }, [premiumModeEnabled, tags]);

  const handleMovieClick = (movie: any) => {
    if (onSearch) {
      onSearch(movie.title);
    }
  };

  const handleRecommendSelect = () => {
    setIsRecommendSelected(true);
  };

  const handleRegularTagSelect = (tagId: string) => {
    if (tagId === PREMIUM_TAG.id || tags.find(t => t.id === tagId)?.label === '高级') {
      window.location.href = '/premium';
      return;
    }
    setIsRecommendSelected(false);
    setSelectedTag(tagId);
  };

  return (
    <div className="animate-fade-in">
      {/* Content Type Toggle (Capsule Liquid Glass - Fixed & Centered) */}
      {!effectiveRecommendSelected && (
        <div className="mb-10 flex justify-center">
          <div className="relative w-80 p-1 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-full grid grid-cols-2 backdrop-blur-2xl shadow-lg ring-1 ring-white/10 overflow-hidden">
            {/* Sliding Indicator */}
            <div
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[var(--accent-color)] rounded-full transition-transform duration-400 cubic-bezier(0.4, 0, 0.2, 1) shadow-[0_0_15px_rgba(0,122,255,0.4)]"
              style={{
                transform: `translateX(${contentType === 'movie' ? '4px' : 'calc(100% + 4px)'})`,
              }}
            />

            <button
              onClick={() => setContentType('movie')}
              className={`relative z-10 py-2.5 text-sm font-bold transition-colors duration-300 cursor-pointer flex justify-center items-center ${contentType === 'movie' ? 'text-white' : 'text-[var(--text-color-secondary)] hover:text-[var(--text-color)]'
                }`}
            >
              电影
            </button>
            <button
              onClick={() => setContentType('tv')}
              className={`relative z-10 py-2.5 text-sm font-bold transition-colors duration-300 cursor-pointer flex justify-center items-center ${contentType === 'tv' ? 'text-white' : 'text-[var(--text-color-secondary)] hover:text-[var(--text-color)]'
                }`}
            >
              电视剧
            </button>
          </div>
        </div>
      )}

      <TagManager
        tags={displayTags}
        selectedTag={effectiveRecommendSelected ? '' : selectedTag}
        showTagManager={showTagManager}
        newTagInput={newTagInput}
        justAddedTag={justAddedTag}
        onTagSelect={handleRegularTagSelect}
        onTagDelete={handleDeleteTag}
        onToggleManager={() => setShowTagManager(!showTagManager)}
        onRestoreDefaults={handleRestoreDefaults}
        onNewTagInputChange={setNewTagInput}
        onAddTag={handleAddTag}
        onDragEnd={handleDragEnd}
        onJustAddedTagHandled={() => setJustAddedTag(false)}
        isLoadingTags={isLoadingTags}
        recommendTag={hasHistory ? {
          label: '为你推荐',
          isSelected: effectiveRecommendSelected,
          onSelect: handleRecommendSelect,
        } : undefined}
      />

      {effectiveRecommendSelected ? (
        <MovieGrid
          movies={recommendMovies}
          loading={recommendLoading}
          hasMore={recommendHasMore}
          onMovieClick={handleMovieClick}
          prefetchRef={recommendPrefetchRef}
          loadMoreRef={recommendLoadMoreRef}
        />
      ) : (
        <MovieGrid
          movies={movies}
          loading={loading}
          hasMore={hasMore}
          onMovieClick={handleMovieClick}
          prefetchRef={prefetchRef}
          loadMoreRef={loadMoreRef}
        />
      )}
    </div>
  );
}
