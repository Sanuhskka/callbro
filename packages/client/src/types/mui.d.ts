// Temporary type declarations for Material-UI
declare module '@mui/material' {
  export interface Theme {
    palette: {
      mode: 'light' | 'dark';
      primary: any;
      secondary: any;
      background: any;
      text: any;
    };
    typography: any;
  }

  export const createTheme: (options?: any) => Theme;
  export const ThemeProvider: React.ComponentType<{ theme: Theme; children: React.ReactNode }>;
  export const CssBaseline: React.ComponentType;
  export const Box: React.ComponentType<any>;
  export const Card: React.ComponentType<any>;
  export const CardContent: React.ComponentType<any>;
  export const TextField: React.ComponentType<any>;
  export const Button: React.ComponentType<any>;
  export const Typography: React.ComponentType<any>;
  export const Alert: React.ComponentType<any>;
  export const CircularProgress: React.ComponentType<any>;
  export const Container: React.ComponentType<any>;
  export const IconButton: React.ComponentType<any>;
  export const InputAdornment: React.ComponentType<any>;
  export const List: React.ComponentType<any>;
  export const ListItem: React.ComponentType<any>;
  export const ListItemButton: React.ComponentType<any>;
  export const ListItemIcon: React.ComponentType<any>;
  export const ListItemText: React.ComponentType<any>;
  export const Avatar: React.ComponentType<any>;
  export const Badge: React.ComponentType<any>;
  export const Divider: React.ComponentType<any>;
  export const Toolbar: React.ComponentType<any>;
  export const AppBar: React.ComponentType<any>;
  export const Paper: React.ComponentType<any>;
  export const Snackbar: React.ComponentType<any>;
  export const Slide: React.ComponentType<any>;
  export const AlertTitle: React.ComponentType<any>;
  export const Drawer: React.ComponentType<any>;
}

declare module '@mui/material/styles' {
  export const createTheme: (options?: any) => any;
  export const ThemeProvider: React.ComponentType<{ theme: any; children: React.ReactNode }>;
}

declare module '@mui/icons-material' {
  export const Phone: React.ComponentType<any>;
  export const Lock: React.ComponentType<any>;
  export const Eye: React.ComponentType<any>;
  export const EyeOff: React.ComponentType<any>;
  export const User: React.ComponentType<any>;
  export const Check: React.ComponentType<any>;
  export const X: React.ComponentType<any>;
  export const Video: React.ComponentType<any>;
  export const VideoOff: React.ComponentType<any>;
  export const Mic: React.ComponentType<any>;
  export const MicOff: React.ComponentType<any>;
  export const Volume2: React.ComponentType<any>;
  export const VolumeX: React.ComponentType<any>;
  export const ArrowLeft: React.ComponentType<any>;
  export const Maximize2: React.ComponentType<any>;
  export const Minimize2: React.ComponentType<any>;
  export const Circle: React.ComponentType<any>;
  export const Settings: React.ComponentType<any>;
  export const LogOut: React.ComponentType<any>;
  export const Menu: React.ComponentType<any>;
  export const MessageSquare: React.ComponentType<any>;
}

declare module '@emotion/react' {
  export const ThemeProvider: React.ComponentType<{ theme: any; children: React.ReactNode }>;
}

declare module '@emotion/styled' {
  interface StyledComponent {
    (template: TemplateStringsArray, ...args: any[]): React.ComponentType<any>;
  }
  const styled: StyledComponent;
  export default styled;
}
