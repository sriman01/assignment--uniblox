import { Link } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFoundPage() {
  return (
    <div className="container section">
      <EmptyState
        icon="search"
        title="We couldn’t find that page"
        message="The page or product you’re looking for doesn’t exist or may have moved."
        action={<Link className="btn btn--primary" to="/products">Browse products</Link>}
      />
    </div>
  );
}
