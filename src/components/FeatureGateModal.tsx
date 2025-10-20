import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FeatureGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  tier?: string | null;
}

export const FeatureGateModal = ({ 
  open, 
  onOpenChange, 
  featureName = "feature",
  tier = null
}: FeatureGateModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Feature Not Available</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              The <strong>{featureName}</strong> feature is not available{tier ? ` in your ${tier} plan` : ' in your current plan'}.
            </p>
            <p>
              Contact your administrator to upgrade or enable this feature.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
