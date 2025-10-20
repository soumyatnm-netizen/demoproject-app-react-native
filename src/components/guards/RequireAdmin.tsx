import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface RequireAdminProps {
  children: ReactNode;
}

export const RequireAdmin = ({ children }: RequireAdminProps) => {
  const { isAdmin, isLoading, user } = useRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/', { replace: true });
      } else if (!isAdmin) {
        toast({
          title: "Access Denied",
          description: "You don't have access to Admin features. Only administrators can access this area.",
          variant: "destructive",
        });
        navigate('/app', { replace: true });
      }
    }
  }, [isAdmin, isLoading, user, navigate, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
};
