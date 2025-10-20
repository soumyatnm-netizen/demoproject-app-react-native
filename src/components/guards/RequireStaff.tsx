import { Navigate } from 'react-router-dom';
import { useRole } from '@/hooks/useRole';
import { useToast } from '@/components/ui/use-toast';
import { useEffect } from 'react';

interface RequireStaffProps {
  children: React.ReactNode;
}

export const RequireStaff = ({ children }: RequireStaffProps) => {
  const { isStaff, loading } = useRole();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !isStaff) {
      toast({
        title: "Access Denied",
        description: "This area is restricted to CoverCompass staff.",
        variant: "destructive",
      });
    }
  }, [loading, isStaff, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
