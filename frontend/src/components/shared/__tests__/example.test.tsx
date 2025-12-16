import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Example component for testing
function ExampleButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
    return <button onClick={onClick}>{children}</button>;
}

describe('ExampleButton', () => {
    it('renders with correct text', () => {
        const handleClick = () => { };
        render(<ExampleButton onClick={handleClick}>Click me</ExampleButton>);

        expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('is a button element', () => {
        const handleClick = () => { };
        render(<ExampleButton onClick={handleClick}>Click me</ExampleButton>);

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
    });
});

// This is an example test file demonstrating how to write tests
// You can create similar test files for your actual components
// 
// Naming convention: ComponentName.test.tsx or ComponentName.spec.tsx
// Location: Place test files in __tests__ folders or next to components
//
// Example structure:
// src/
//   components/
//     shared/
//       Button/
//         Button.tsx
//         Button.test.tsx
//       __tests__/
//         AnotherComponent.test.tsx
