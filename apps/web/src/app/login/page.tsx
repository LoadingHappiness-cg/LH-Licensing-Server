import LoginForm from "./LoginForm";

export default function LoginPage({ searchParams }: { searchParams?: { callbackUrl?: string } }) {
  return <LoginForm callbackUrl={searchParams?.callbackUrl || "/dashboard"} />;
}
