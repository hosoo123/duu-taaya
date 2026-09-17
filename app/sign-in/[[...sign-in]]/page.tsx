import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="clerk-page">
      <SignIn />
    </main>
  );
}
