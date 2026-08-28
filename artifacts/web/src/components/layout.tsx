import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetPublicMe, useLogoutBuyer, getGetPublicMeQueryKey } from "@workspace/api-client-react";
import { User, LogOut, Menu, Search } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuickSearchDialog } from "@/components/QuickSearchDialog";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetPublicMe({ query: { retry: false, queryKey: getGetPublicMeQueryKey() } });
  const logout = useLogoutBuyer();
  const [, setLocation] = useLocation();
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
        window.location.reload();
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-gray-50">
      <QuickSearchDialog open={quickSearchOpen} onOpenChange={setQuickSearchOpen} />
      <header className="sticky top-0 z-50 w-full border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuickProp" className="h-8 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/search" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Buy
            </Link>
            <Link href="/search?listingType=rent" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Rent
            </Link>
            <Link href="/agents" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">
              Agents
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setQuickSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-500 hover:border-primary/40 hover:bg-emerald-50/60 hover:text-primary transition-all"
            >
              <Search className="h-4 w-4" />
              Quick search
            </button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <User className="h-4 w-4" />
                    {user.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation("/account")}>
                    My Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setLocation("/login")}>
                  Log in
                </Button>
                <Button onClick={() => setLocation("/register")}>
                  Sign up
                </Button>
              </>
            )}
          </div>

          {/* Mobile Nav Toggle */}
          <div className="md:hidden flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setLocation("/search")}>Buy</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/search?listingType=rent")}>Rent</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/agents")}>Agents</DropdownMenuItem>
                <div className="h-px bg-gray-100 my-1 mx-2" />
                {user ? (
                  <>
                    <DropdownMenuItem onClick={() => setLocation("/account")}>My Account</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setLocation("/login")}>Log in</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/register")}>Sign up</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="bg-white border-t py-12 mt-auto">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <Link href="/" className="flex items-center">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="QuickProp" className="h-8 w-auto" />
              </Link>
              <p className="text-sm text-gray-500 max-w-xs">
                Zimbabwe's trusted property marketplace. Find your next home or connect with verified real estate agents.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-gray-900">Properties</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/search?listingType=sale" className="hover:text-primary">Houses for Sale</Link></li>
                <li><Link href="/search?listingType=rent" className="hover:text-primary">Houses to Rent</Link></li>
                <li><Link href="/search?propertyType=apartment" className="hover:text-primary">Apartments</Link></li>
                <li><Link href="/search?propertyType=stand" className="hover:text-primary">Stands & Land</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-gray-900">Agents</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/agents" className="hover:text-primary">Find an Agent</Link></li>
                <li><Link href="/agents" className="hover:text-primary">Agencies in Harare</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-gray-900">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>support@quickprop.co.zw</li>
                <li>+263 242 123456</li>
                <li>Harare, Zimbabwe</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 text-center text-sm text-gray-500 flex flex-col md:flex-row justify-between items-center gap-4">
            <p>&copy; {new Date().getFullYear()} QuickProp. All rights reserved.</p>
            <div className="flex gap-4">
              <span className="hover:text-primary cursor-pointer">Terms</span>
              <span className="hover:text-primary cursor-pointer">Privacy</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
