(function (root, factory) {
    const config = factory();

    if (typeof module === "object" && module.exports) {
        module.exports = config;
        return;
    }

    root.HANDIREPERE_DOCTOR_CONFIG = config;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    const doctorAccountEmail = "louis.ortega@coda-student.school";
    const defaultAppointmentDurationMinutes = 60;
    const appointmentDurationOptions = [30, 45, 60];
    const weeklyTimeSlots = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
    const weeklyDayOrder = [1, 2, 3, 4, 5, 6, 0];
    const weeklyAvailabilityTemplate = weeklyDayOrder.reduce((template, dayOfWeek) => {
        template[dayOfWeek] = weeklyTimeSlots.slice();
        return template;
    }, {});

    return {
        doctorAccountEmail,
        appointmentDurationOptions,
        doctorDisplayName: "Louis",
        doctorKey: "medecin-louis-coda",
        defaultAppointmentDurationMinutes,
        managedDoctorIndex: 0,
        publicDoctorProfile: {
            cabinetName: "Cabinet du Dr Ortega",
            firstName: "Louis",
            lastName: "Ortega",
            professionalEmail: doctorAccountEmail
        },
        randomUserResults: 5,
        randomUserSeed: "handirepere-medecins",
        weeklyAvailabilityTemplate,
        weeklyDayOrder,
        weeklyTimeSlots
    };
});
