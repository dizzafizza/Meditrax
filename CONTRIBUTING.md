# Contributing to Meditrax

We love your input! We want to make contributing to Meditrax as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## We Use [GitHub Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/your-username/Meditrax/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/your-username/Meditrax/issues/new); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Development Guidelines

### Code Style

* Use TypeScript strict mode
* Follow the existing patterns in the codebase
* Use meaningful variable and function names
* Add JSDoc comments for complex functions
* Keep components small and focused

### Component Structure

```typescript
// Component imports
import React from 'react';
import { ComponentProps } from '@/types';

// Interface definition
interface MyComponentProps {
  // Props definition
}

// Component implementation
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  // Component logic
  return (
    // JSX
  );
}
```

### State Management

* Use Zustand for global state
* Keep state minimal and normalized
* Use React hooks for local component state
* Avoid deeply nested state structures

### Styling

* Use Tailwind CSS classes
* Follow the existing responsive design patterns
* Ensure mobile compatibility for all components
* Use custom CSS classes only when necessary

### Testing

* Write unit tests for utility functions
* Test component rendering and user interactions
* Ensure accessibility compliance
* Test on multiple browsers and devices

## Feature Requests

We welcome feature requests! Please open an issue with:

- A clear description of the feature
- Use cases and benefits
- Possible implementation approach
- Screenshots or mockups if applicable

## Health & Safety Considerations

Since Meditrax deals with health information:

- Never include real medical data in examples or tests
- Be mindful of privacy and security implications
- Follow healthcare data best practices
- Consider accessibility for users with disabilities

## Getting Help

- Read the existing documentation
- Check closed issues for similar problems
- Ask questions in the discussions section
- Reach out to maintainers for guidance

## License

By contributing, you agree that your contributions will be licensed under its MIT License.

## References

This document was adapted from the open-source contribution guidelines for [Facebook's Draft](https://github.com/facebook/draft-js/blob/master/CONTRIBUTING.md).
