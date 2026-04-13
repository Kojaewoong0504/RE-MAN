import { LoginPageClient } from "@/components/auth/LoginPageClient";

type LoginPageProps = {
  searchParams?: {
    returnTo?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return <LoginPageClient returnTo={searchParams?.returnTo || "/profile"} />;
}
