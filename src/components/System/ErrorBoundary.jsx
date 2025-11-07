import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold">Something went wrong 😔</h2>
          <p className="mt-2 text-gray-500">Please refresh the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

