import { logoutAction } from "@/app/(auth)/actions";

export function LogoutForm() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="label-caps text-muted transition-colors hover:text-accent"
      >
        Log out
      </button>
    </form>
  );
}
