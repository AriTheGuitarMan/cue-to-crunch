import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Studio from "@/pages/Studio";

const fakeBuffer = {
  duration: 12,
  sampleRate: 44100,
  numberOfChannels: 1,
  length: 2048,
  getChannelData: () => new Float32Array(2048),
} as unknown as AudioBuffer;

const {
  connectAndPlayMock,
  playDryMock,
  destroyEngineMock,
  stopPlaybackMock,
  applyParamsMock,
  saveGuestAudioBlobMock,
} = vi.hoisted(() => {
  const playSourceFactory = () => ({ onended: null as null | (() => void) });
  return {
    connectAndPlayMock: vi.fn(() => playSourceFactory()),
    playDryMock: vi.fn(() => playSourceFactory()),
    destroyEngineMock: vi.fn(),
    stopPlaybackMock: vi.fn(),
    applyParamsMock: vi.fn(),
    saveGuestAudioBlobMock: vi.fn(async () => "guest-audio://saved-file"),
  };
});

vi.mock("framer-motion", () => {
  const passthrough = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>,
  );
  return {
    motion: new Proxy({}, { get: () => passthrough }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn(),
        download: vi.fn(),
        getPublicUrl: vi.fn(),
      }),
    },
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      then: vi.fn(),
    }),
  },
}));

vi.mock("@/lib/audioEngine", () => ({
  loadAudioFile: vi.fn(async () => fakeBuffer),
  createEngine: vi.fn(() => ({
    analyser: null,
    ctx: {
      state: "running",
      resume: vi.fn(async () => undefined),
    },
  })),
  connectAndPlay: connectAndPlayMock,
  playDry: playDryMock,
  stopPlayback: stopPlaybackMock,
  destroyEngine: destroyEngineMock,
  applyParams: applyParamsMock,
  renderProcessedBuffer: vi.fn(async () => fakeBuffer),
}));

vi.mock("@/lib/aiToneEngine", () => ({
  analyzeSourceAudio: vi.fn(() => ({
    brightness: 0.5,
    density: 0.5,
    dynamics: 0.5,
  })),
  applyAiToneStrategy: vi.fn(({ parsedParams }) => ({
    params: parsedParams,
    reasons: ["test tone strategy"],
  })),
}));

vi.mock("@/lib/audioQuality", () => ({
  extractMono: vi.fn(() => new Float32Array(32)),
  measureDryWetDelta: vi.fn(() => ({ energyDelta: 1, spectralDelta: 1 })),
  isAudibleDelta: vi.fn(() => true),
}));

vi.mock("@/lib/guestStore", () => ({
  appendGuestKnowledge: vi.fn(),
  appendGuestSession: vi.fn(),
  getGuestSessions: vi.fn(() => []),
  getGuestProfile: vi.fn(() => ({
    display_name: "Guest Producer",
    lifetime_time_saved_minutes: 0,
    lifetime_money_saved: 0,
  })),
  updateGuestProfile: vi.fn(),
}));

vi.mock("@/lib/guestAudioStore", () => ({
  isGuestAudioRef: vi.fn(() => false),
  loadGuestAudioBlob: vi.fn(),
  parseGuestAudioRef: vi.fn(() => null),
  saveGuestAudioBlob: saveGuestAudioBlobMock,
}));

vi.mock("@/components/studio/StudioLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/studio/Waveform", () => ({
  default: () => <div data-testid="waveform" />,
}));

vi.mock("@/components/studio/EffectKnobs", () => ({
  default: () => <div data-testid="effect-knobs" />,
}));

vi.mock("@/components/studio/LiveRecorder", () => ({
  default: () => <div data-testid="live-recorder" />,
}));

vi.mock("@/components/studio/ValueSummary", () => ({
  calculateSavings: vi.fn(() => ({
    timeSavedMinutes: 20,
    moneySaved: 30,
    manualMinutesPerOutputMinute: 10,
  })),
  default: () => <div data-testid="value-summary" />,
}));

vi.mock("@/components/studio/DAWExport", () => ({
  default: () => <div data-testid="daw-export" />,
}));

vi.mock("@/components/studio/IterationHistory", () => ({
  default: () => <div data-testid="iteration-history" />,
}));

vi.mock("@/components/studio/GrowthAutomationSuite", () => ({
  default: () => <div data-testid="growth-ops" />,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function renderStudio() {
  return render(
    <MemoryRouter>
      <Studio />
    </MemoryRouter>,
  );
}

async function uploadAudio(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(input).not.toBeNull();
  const file = new File(["fake-audio"], "guitar.wav", { type: "audio/wav" });
  await act(async () => {
    fireEvent.change(input!, { target: { files: [file] } });
  });
}

describe("studio interaction flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("supports generate, mark perfect, refine, and re-generate from step 2", async () => {
    const { container } = renderStudio();
    await uploadAudio(container);

    fireEvent.change(screen.getByPlaceholderText(/warm blues tone/i), {
      target: { value: "ambient ethereal space" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Active Version: Remix v1/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /This is perfect/i }));
    fireEvent.click(screen.getByRole("button", { name: /Refine it/i }));
    fireEvent.change(screen.getByPlaceholderText(/make it more percussive/i), {
      target: { value: "tighter low end, less muddiness" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Refine" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Active Version: Remix v2/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/warm blues tone/i), {
      target: { value: "heavy metal crunch, tight low-end" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Active Version: Remix v1/i)).toBeInTheDocument();
    });
  });

  it("lets the user play wet, stop, and continue interacting with step 3 controls", async () => {
    const { container } = renderStudio();
    await uploadAudio(container);

    fireEvent.change(screen.getByPlaceholderText(/warm blues tone/i), {
      target: { value: "ambient ethereal space" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Play with Effects/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Play with Effects/i }));
    expect(connectAndPlayMock).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Stop/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Stop/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Play with Effects/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Refine it/i }));
    expect(screen.getByRole("button", { name: "Refine" })).toBeInTheDocument();
  });
});
