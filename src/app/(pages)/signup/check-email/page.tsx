import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a confirmation link. Click it to finish creating your
            account and sign in.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
