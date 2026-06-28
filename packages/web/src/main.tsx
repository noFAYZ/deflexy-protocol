import React, { useSyncExternalStore } from "react";
import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { wagmiConfig } from "./wagmi";
import App from "./App";
import { Status } from "./components/Status";
import "sileo/styles.css";
import "./index.css";
import { Toaster } from "sileo";

const queryClient = new QueryClient();

// Tiny hash route: #/status → status dashboard, anything else → the app. Avoids pulling in
// a router for one extra page.
const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
function Root() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash === "#/status" ? <Status /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
        <Toaster
          position="bottom-center"
          theme="dark"
          options={{
            roundness: 16,
            fill: "#1a181f",
            styles: {
              title: "text-white! font-medium!",
              description: "text-white/70!",
              badge: "bg-white/10!",
              button: "bg-white/10! hover:bg-white/15! text-white!",
            },
          }}
        />
          <Root />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
