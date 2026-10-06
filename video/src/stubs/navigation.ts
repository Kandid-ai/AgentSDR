/**
 * next/navigation outside Next. The borrowed screens call these hooks for
 * links and filters the video never follows, so each returns an inert value.
 */
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };

export const useRouter = () => router;
export const usePathname = () => "/";
export const useSearchParams = () => new URLSearchParams();
export const useParams = () => ({});
export const redirect = () => {};
export const notFound = () => {};
