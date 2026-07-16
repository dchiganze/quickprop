import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Search, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="h-24 w-24 bg-emerald-50 text-primary rounded-full flex items-center justify-center mb-6">
          <Search className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Page not found</h1>
        <p className="text-lg text-gray-500 max-w-md mb-8">
          We couldn't find the page you're looking for. It might have been moved or removed.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/search">Browse Properties</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
