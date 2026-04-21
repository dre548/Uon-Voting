import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the SpeedInsights component
jest.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null,
}));

test('renders welcome message', () => {
  render(<App />);
  const welcomeElement = screen.getByText(/Welcome to the Secure E-Voting Portal/i);
  expect(welcomeElement).toBeInTheDocument();
});
