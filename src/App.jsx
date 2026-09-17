import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Listings from '@/pages/Listings';
import ListingDetail from '@/pages/ListingDetail';
import Subscribe from '@/pages/Subscribe';
import PaymentCallback from '@/pages/PaymentCallback';
import CreateListing from '@/pages/CreateListing';
import EditListing from '@/pages/EditListing';
import Dashboard from '@/pages/Dashboard';
import Admin from '@/pages/Admin';
import AgentProfilePage from '@/pages/AgentProfile';
import DaBros from '@/pages/DaBros';
import DaBrosDetail from '@/pages/DaBrosDetail';
import CreateBrosListing from '@/pages/CreateBrosListing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  // Brief spinner while we check for an existing Supabase session. Individual
  // pages (Dashboard, CreateListing, etc.) handle their own auth redirects —
  // most routes here are public.
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/payment-callback" element={<PaymentCallback />} />
        <Route path="/create" element={<CreateListing />} />
        <Route path="/edit/:id" element={<EditListing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/agent/:userId" element={<AgentProfilePage />} />
        <Route path="/da-bros" element={<DaBros />} />
        <Route path="/da-bros/create" element={<CreateBrosListing />} />
        <Route path="/da-bros/:id" element={<DaBrosDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App