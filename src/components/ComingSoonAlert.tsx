import { AlertCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ComingSoonAlertProps {
  featureName?: string;
}

const ComingSoonAlert = ({ featureName = "This feature" }: ComingSoonAlertProps) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-8">
      <Alert className="max-w-md">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <AlertCircle className="h-5 w-5" />
        </div>
        <AlertTitle className="text-xl font-semibold mt-2">Coming Soon!</AlertTitle>
        <AlertDescription className="mt-2 text-base">
          {featureName} is not currently available for your account. 
          <br />
          <br />
          Contact your administrator or Cover Compass support to enable this feature.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ComingSoonAlert;
