import "./animated-background.css";

export default function AnimatedBackground({ className = "" }) {
    return <div className={ `animated-background ${className}` } aria-hidden="true" />;
}
