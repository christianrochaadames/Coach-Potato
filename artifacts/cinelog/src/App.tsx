import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { BottomNav } from '@/components/bottom-nav';
import Home from '@/pages/home';
import MyShows from '@/pages/my-shows';
import Search from '@/pages/search';
import Watchlist from '@/pages/watchlist';
import Stats from '@/pages/stats';
import Profile from '@/pages/profile';
import EntryDetail from '@/pages/entry-detail';
import AddEntry from '@/pages/add-entry';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh]" style={{ background: '#FFF3E8' }}>
      <main className="flex-1 pb-20 overflow-y-auto">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/my-shows" component={MyShows} />
          <Route path="/search" component={Search} />
          <Route path="/watchlist" component={Watchlist} />
          <Route path="/stats" component={Stats} />
          <Route path="/profile" component={Profile} />
          <Route path="/entry/:id" component={EntryDetail} />
          <Route path="/add" component={AddEntry} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
