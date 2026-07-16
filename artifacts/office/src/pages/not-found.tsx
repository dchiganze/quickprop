export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        <h1 className="text-8xl font-bold text-primary mb-4 tracking-tighter">404</h1>
        <h2 className="text-2xl font-bold text-foreground mb-4">Page not found</h2>
        <p className="text-muted-foreground mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <button 
          onClick={() => window.history.back()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 rounded-md font-medium transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}