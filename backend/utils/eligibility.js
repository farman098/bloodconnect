export const DONATION_INTERVAL_DAYS = 90;

// Calculate eligibility on the server so the client cannot bypass the donation interval.
export function getDonationEligibility(lastDonationDate, now = new Date()) {
    if (!lastDonationDate) return { eligible: true, eligibleOn: null };

    const lastDonation = new Date(lastDonationDate);
    if (Number.isNaN(lastDonation.getTime())) return { eligible: true, eligibleOn: null };

    const eligibleOn = new Date(lastDonation);
    eligibleOn.setDate(eligibleOn.getDate() + DONATION_INTERVAL_DAYS);
    return { eligible: eligibleOn <= now, eligibleOn };
}

export function formatUrgency(urgency) {
    if (urgency === "Critical" || urgency === "Urgent") return "Emergency";
    if (urgency === "Scheduled") return "Scheduled";
    return "Normal";
}

export function urgencyWeight(urgency) {
    return urgency === "Critical" || urgency === "Urgent" ? 3 : urgency === "Normal" ? 2 : 1;
}

export function urgencyLevelWeight(urgencyLevel, legacyUrgency) {
    return urgencyLevel === "Emergency" || legacyUrgency === "Critical" || legacyUrgency === "Urgent" ? 1 : 0;
}