import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Film, Tv, Edit2, Trash2, X, Check, Calendar } from 'lucide-react';
import {
  useGetEntry,
  useUpdateEntry,
  useDeleteEntry,
  getGetEntryQueryKey,
  getListEntriesQueryKey,
  getListYearsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StarRating } from '@/components/star-rating';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['movie', 'show']),
  posterUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  dateWatched: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function EntryDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  const entryId = params.id ? Number(params.id) : undefined;
  const { data: entry, isLoading } = useGetEntry(entryId!, {
    query: {
      enabled: !!entryId,
      queryKey: getGetEntryQueryKey(entryId!),
    },
  });

  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      type: 'movie',
      posterUrl: '',
      dateWatched: '',
      notes: '',
      tags: '',
    },
  });

  // Initialize form when entry loads
  useEffect(() => {
    if (entry) {
      form.reset({
        title: entry.title,
        type: entry.type,
        posterUrl: entry.posterUrl || '',
        dateWatched: entry.dateWatched,
        notes: entry.notes || '',
        tags: entry.tags?.join(', ') || '',
      });
      setRating(entry.rating || null);
    }
  }, [entry, form]);

  const onSubmit = (data: FormData) => {
    if (!entryId) return;

    const tags = data.tags
      ? data.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : [];

    updateEntry.mutate(
      {
        id: entryId,
        data: {
          title: data.title,
          type: data.type,
          posterUrl: data.posterUrl || null,
          dateWatched: data.dateWatched,
          rating: rating || null,
          notes: data.notes || null,
          tags,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Entry updated',
            description: 'Your changes have been saved',
          });
          queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(entryId) });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          setIsEditing(false);
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to update entry. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!entryId) return;

    deleteEntry.mutate(
      { id: entryId },
      {
        onSuccess: () => {
          toast({
            title: 'Entry deleted',
            description: 'The entry has been removed from your collection',
          });
          queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListYearsQueryKey() });
          setLocation('/');
        },
        onError: () => {
          toast({
            title: 'Error',
            description: 'Failed to delete entry. Please try again.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="container mx-auto px-6 py-12">
          <div className="max-w-4xl mx-auto animate-pulse space-y-6">
            <div className="h-96 bg-card rounded-lg" />
            <div className="h-8 bg-card rounded w-1/3" />
            <div className="h-4 bg-card rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="text-xl font-semibold mb-2">Entry not found</h3>
            <p className="text-muted-foreground mb-6">This entry does not exist</p>
            <Button onClick={() => setLocation('/')}>Go Home</Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedType = form.watch('type');

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Actions */}
          <div className="flex items-center justify-between mb-8">
            <Button variant="outline" onClick={() => setLocation('/')} data-testid="button-back">
              Back to Collection
            </Button>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                    data-testid="button-edit"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="gap-2 text-destructive hover:text-destructive"
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    form.reset();
                    setRating(entry.rating || null);
                  }}
                  className="gap-2"
                  data-testid="button-cancel-edit"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {isEditing ? (
            /* Edit Mode */
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
                    data-testid="button-edit-type-movie"
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
                    data-testid="button-edit-type-show"
                  >
                    <Tv className={cn('w-8 h-8', selectedType === 'show' ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('font-medium', selectedType === 'show' ? 'text-primary' : 'text-foreground')}>
                      Show
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...form.register('title')} data-testid="input-edit-title" />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="dateWatched">Date Watched *</Label>
                <Input id="dateWatched" type="date" {...form.register('dateWatched')} data-testid="input-edit-date" />
              </div>

              <div className="space-y-3">
                <Label>Rating</Label>
                <StarRating rating={rating} onRatingChange={setRating} size="lg" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="posterUrl">Poster URL</Label>
                <Input id="posterUrl" type="url" {...form.register('posterUrl')} data-testid="input-edit-poster" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" rows={4} {...form.register('notes')} data-testid="input-edit-notes" />
              </div>

              <div className="space-y-3">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" {...form.register('tags')} data-testid="input-edit-tags" />
              </div>

              <Button type="submit" disabled={updateEntry.isPending} data-testid="button-save">
                {updateEntry.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          ) : (
            /* View Mode */
            <div className="grid md:grid-cols-[300px,1fr] gap-8">
              {/* Poster */}
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-card border border-border">
                {entry.posterUrl ? (
                  <img src={entry.posterUrl} alt={entry.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted to-muted/50">
                    <div className="text-5xl font-display font-bold text-white/90">
                      {entry.title[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="text-muted-foreground">
                      {entry.type === 'movie' ? <Film className="w-6 h-6" /> : <Tv className="w-6 h-6" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    {entry.type === 'movie' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
                    <span className="uppercase tracking-wider">{entry.type}</span>
                  </div>
                  <h1 className="text-4xl font-display font-bold mb-4" data-testid="text-entry-title">
                    {entry.title}
                  </h1>
                  {entry.rating && (
                    <StarRating rating={entry.rating} readonly size="lg" />
                  )}
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Watched on {new Date(entry.dateWatched).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                {entry.notes && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
                    <p className="text-foreground leading-relaxed" data-testid="text-entry-notes">
                      {entry.notes}
                    </p>
                  </div>
                )}

                {entry.tags && entry.tags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30"
                          data-testid={`tag-${tag}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{entry.title}" from your collection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
