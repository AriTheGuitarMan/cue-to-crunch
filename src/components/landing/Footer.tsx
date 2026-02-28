const Footer = () => (
  <footer className="border-t border-border py-12">
    <div className="container px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground text-lg text-gradient-primary">ToneForge AI</span>
      <p>&copy; {new Date().getFullYear()} ToneForge. All rights reserved.</p>
    </div>
  </footer>
);

export default Footer;
