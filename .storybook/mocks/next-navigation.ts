export const usePathname = () => "/";
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
});
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
