import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

export const STATUS_ICON = {
    ok: "✓",
    missing: "✗",
} as const;

const SPINNER_FRAMES = {
    dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    line: ["-", "\\", "|", "/"],
    arrows: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
} as const;

export type SpinnerType = keyof typeof SPINNER_FRAMES;

export interface RunWithSpinnerOptions {
    spinnerType?: SpinnerType;
}

function getRandomSpinnerType(): SpinnerType {
    const spinnerTypes = Object.keys(SPINNER_FRAMES) as SpinnerType[];
    const index = Math.floor(Math.random() * spinnerTypes.length);
    return spinnerTypes[index] ?? "dots";
}

export async function runWithSpinner<T>(
    ctx: ExtensionCommandContext,
    widgetId: string,
    lines: string[],
    loadingMessage: string,
    task: () => Promise<T>,
    options: RunWithSpinnerOptions = {},
): Promise<T> {
    const spinnerType = options.spinnerType ?? getRandomSpinnerType();
    const spinnerFrames = SPINNER_FRAMES[spinnerType];
    let frame = 0;

    const renderLoading = () => {
        ctx.ui.setWidget(widgetId, [
            ...lines,
            `${spinnerFrames[frame % spinnerFrames.length]} ${loadingMessage}`,
        ]);
        frame += 1;
    };

    renderLoading();

    const interval = setInterval(renderLoading, 100);

    try {
        return await task();
    } finally {
        clearInterval(interval);
        ctx.ui.setWidget(widgetId, undefined);
    }
}
