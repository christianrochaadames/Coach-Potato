import { useState } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Film, Tv, Plus, X } from 'lucide-react';
import { useCreateEntry, getListEntriesQueryKey, getListYearsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StarRating } from '@/components/star-rating';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['movie', 'show']),
  posterUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  dateWatched: z.string().min(1, 'Date is required'),
  rating: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function AddEntry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createEntry = useCreateEntry();
  const [rating, setRating] = useState<number | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      type: 'movie',
      posterUrl: '',
      dateWatched: new Date().toISOString().split('T')[0],
      notes: '',
      tags: '',
    },
  });

  const selectedType = form.watch('type');

  const onSubmit = (data: FormData) => {
    const tags = data.tags
      ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    createEntry.mutate(
      {
        data: {
          title: data.title,
          type: data.type,
          posterUrl: data.posterUrl || undefined,
          dateWatched: data.dateWatched,
          rating: rating || undefined,
          notes: data.notes || undefined,
          tags,
        },
      },
      {
        onSuccess: (entry) => {
          toast({
            title: 'Entry logged',
            description: `${entry.title} has been added to your collection`,
          });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setLocation('/');
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to create entry. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-6 py-12 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Log New Entry</h1>
          <p className="text-muted-foreground">Add a movie or show to your collection</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Type Selector */}
          <div className="space-y-3">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => form.setValue('type', 'movie')}
                className={cn(
                  'relative p-6 rounded-lg border-2 transition-all duration-200',
                  'flex flex-col items-center gap-3',
                  selectedType === 'movie'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                data-testid="button-type-movie"
              >
                <Film className={cn('w-8 h-8', selectedType === 'movie' ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('font-medium', selectedType === 'movie' ? 'text-primary' : 'text-foreground')}>
                  Movie
                </span>
              </button>

              <button
                type="button"
                onClick={() => form.setValue('type', 'show')}
                className={cn(
                  'relative p-6 rounded-lg border-2 transition-all duration-200',
                  'flex flex-col items-center gap-3',
                  selectedType === 'show'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                data-testid="button-type-show"
              >
                <Tv className={cn('w-8 h-8', selectedType === 'show' ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn('font-medium', selectedType === 'show' ? 'text-primary' : 'text-foreground')}>
                  Show
                </span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-3">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter title..."
              {...form.register('title')}
              data-testid="input-title"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          {/* Date Watched */}
          <div className="space-y-3">
            <Label htmlFor="dateWatched">Date Watched *</Label>
            <Input
              id="dateWatched"
              type="date"
              {...form.register('dateWatched')}
              data-testid="input-date"
            />
            {form.formState.errors.dateWatched && (
              <p className="text-sm text-destructive">{form.formState.errors.dateWatched.message}</p>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <Label>Rating</Label>
            <div className="flex items-center gap-4">
              <StarRating rating={rating} onRatingChange={setRating} size="lg" />
              {rating && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRating(null)}
                  data-testid="button-clear-rating"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Poster URL */}
          <div className="space-y-3">
            <Label htmlFor="posterUrl">Poster URL (optional)</Label>
            <Input
              id="posterUrl"
              type="url"
              placeholder="https://..."
              {...form.register('posterUrl')}
              data-testid="input-poster-url"
            />
            {form.formState.errors.posterUrl && (
              <p className="text-sm text-destructive">{form.formState.errors.posterUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Leave empty for a generated placeholder
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Your thoughts..."
              rows={4}
              {...form.register('notes')}
              data-testid="input-notes"
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label htmlFor="tags">Tags (optional)</Label>
            <Input
              id="tags"
              placeholder="action, thriller, rewatch (comma-separated)"
              {...form.register('tags')}
              data-testid="input-tags"
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={createEntry.isPending}
              data-testid="button-submit"
            >
              {createEntry.isPending ? 'Logging...' : 'Log Entry'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation('/')}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
