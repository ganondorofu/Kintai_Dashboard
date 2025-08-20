'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { completeRegistration } from '@/actions/auth';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  firstname: z.string().min(1, 'First name is required'),
  lastname: z.string().min(1, 'Last name is required'),
  teamId: z.string().min(1, 'Please select a team'),
  grade: z.coerce.number().min(1, 'Grade is required'),
});

type RegisterFormValues = z.infer<typeof formSchema>;

interface RegisterFormProps {
  token: string;
  user: User;
}

// Mock teams data. In a real app, this would come from Firestore.
const teams = [
    { id: 'dev', name: 'Development Team' },
    { id: 'design', name: 'Design Team' },
    { id: 'pm', name: 'Project Management' },
];

export default function RegisterForm({ token, user }: RegisterFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstname: user.displayName?.split(' ')[0] || '',
      lastname: user.displayName?.split(' ')[1] || '',
      teamId: '',
      grade: undefined,
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setLoading(true);
    setError(null);
    try {
      const result = await completeRegistration(values, token);
      if (result.error) {
        setError(result.error);
        toast({ title: 'Registration Failed', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Registration Successful!', description: 'You can now use your card to log attendance.' });
        // Optionally redirect or show success message.
        // For this app, the kiosk screen will auto-update. We can show a success message here.
        form.reset();
        // Display a view saying registration is complete and they can close the window.
      }
    } catch (e) {
      setError('An unexpected error occurred.');
       toast({ title: 'Registration Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };
  
   if (form.formState.isSubmitSuccessful) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-primary">Registration Complete!</CardTitle>
          <CardDescription>
            You can now close this window and use your NFC tag at the kiosk.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
        <CardDescription>
          Your GitHub account is authenticated. Please provide a few more details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Taro" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                        <Input placeholder="Yamada" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="teamId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your team" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="grade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade (e.g., 42 for 42nd generation)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="42" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Registration
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
