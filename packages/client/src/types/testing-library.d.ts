// Temporary type declarations for testing library
declare module '@testing-library/react' {
  export function render(
    ui: React.ReactElement,
    options?: any
  ): {
    container: HTMLElement;
    baseElement: HTMLElement;
    debug: () => void;
    rerender: (ui: React.ReactElement) => void;
    unmount: () => void;
    getByText: (text: string | RegExp) => HTMLElement;
    getByLabelText: (text: string | RegExp) => HTMLElement;
    getByRole: (role: string, options?: any) => HTMLElement;
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByRole: (role: string, options?: any) => HTMLElement | null;
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findByLabelText: (text: string | RegExp) => Promise<HTMLElement>;
    findByRole: (role: string, options?: any) => Promise<HTMLElement>;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getAllByLabelText: (text: string | RegExp) => HTMLElement[];
    getAllByRole: (role: string) => HTMLElement[];
  };

  export function waitFor<T>(
    callback: () => T,
    options?: { timeout?: number; interval?: number }
  ): Promise<T>;

  export const fireEvent: {
    change(element: HTMLElement, event: { target: { value: string } }): void;
    click(element: HTMLElement): void;
  };

  export const screen: {
    getByText: (text: string | RegExp) => HTMLElement;
    getByLabelText: (text: string | RegExp) => HTMLElement;
    getByPlaceholderText: (text: string | RegExp) => HTMLElement;
    getByRole: (role: string, options?: any) => HTMLElement;
    queryByText: (text: string | RegExp) => HTMLElement | null;
    queryByLabelText: (text: string | RegExp) => HTMLElement | null;
    queryByRole: (role: string, options?: any) => HTMLElement | null;
    findByText: (text: string | RegExp) => Promise<HTMLElement>;
    findByLabelText: (text: string | RegExp) => Promise<HTMLElement>;
    findByRole: (role: string, options?: any) => Promise<HTMLElement>;
    getAllByText: (text: string | RegExp) => HTMLElement[];
    getAllByLabelText: (text: string | RegExp) => HTMLElement[];
    getAllByRole: (role: string) => HTMLElement[];
  };
}

declare module '@testing-library/jest-dom' {
  interface JestMatchers<R> {
    toBeInTheDocument(): R;
    toHaveValue(value: string): R;
    toHaveAttribute(attr: string, value?: string): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toHaveClass(className: string): R;
    toHaveStyle(style: Record<string, string>): R;
    toContainHTML(html: string): R;
    toHaveTextContent(text: string | RegExp): R;
  }
}

declare module '@testing-library/user-event' {
  export interface UserEvent {
    click(element: HTMLElement): Promise<void>;
    type(element: HTMLElement, text: string): Promise<void>;
    clear(element: HTMLElement): Promise<void>;
    tab(): Promise<void>;
    keyboard(text: string): Promise<void>;
  }
  
  export const userEvent: UserEvent;
}

// Extend Jest's expect matchers globally
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveValue(value: string): R;
      toHaveAttribute(attr: string, value?: string): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toBeEnabled(): R;
      toHaveClass(className: string): R;
      toHaveStyle(style: Record<string, string>): R;
      toContainHTML(html: string): R;
      toHaveTextContent(text: string | RegExp): R;
    }
  }
}
