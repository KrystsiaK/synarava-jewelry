import { logoutAction } from "@/app/(auth)/actions";

export function LogoutForm() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="adm-btn-ghost w-full"
      >
        Log out
      </button>
    </form>
  );
}
