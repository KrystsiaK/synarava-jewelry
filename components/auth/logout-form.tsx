import { adminLogoutAction } from "@/app/admin/login/actions";

export function LogoutForm() {
  return (
    <form data-component="LogoutForm" action={adminLogoutAction}>
      <button
        type="submit"
        className="adm-btn-ghost w-full"
      >
        Log out
      </button>
    </form>
  );
}
