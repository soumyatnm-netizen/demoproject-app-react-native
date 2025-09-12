import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const TestOpenAI = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testOpenAI = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-openai');
      
      if (error) {
        throw error;
      }
      
      setResult(data);
      
      if (data.success) {
        toast({
          title: "OpenAI Test Successful",
          description: "Your OpenAI API key is working correctly",
        });
      } else {
        toast({
          title: "OpenAI Test Failed", 
          description: data.error,
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: "Test Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>OpenAI API Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testOpenAI} 
          disabled={testing}
          className="w-full"
        >
          {testing ? 'Testing...' : 'Test OpenAI API'}
        </Button>
        
        {result && (
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Test Result:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};