#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <array>

namespace lpc
{
class AirBand
{
public:
    static constexpr std::array<int, 3> frequenciesKHz { 10, 20, 40 };

    void prepare (double sampleRate, int band, float decibels) noexcept
    {
        for (size_t i = 0; i < poles.size(); ++i)
        {
            // Bilinear mapping without prewarping. The analog poles above
            // Nyquist still approach it at different rates.
            const auto k = juce::MathConstants<double>::pi * 1000.0 * frequenciesKHz[i] / sampleRate;
            poles[i] = k / (1.0 + k);
        }
        pole.reset (sampleRate, 0.020);
        boost.reset (sampleRate, 0.020);
        pole.setCurrentAndTargetValue (poles[(size_t) band]);
        targetDb = decibels;
        boost.setCurrentAndTargetValue (juce::Decibels::decibelsToGain ((double) decibels) - 1.0);
        integrator = 0.0;
    }

    void setParameters (int band, float decibels) noexcept
    {
        const auto coefficient = poles[(size_t) band];
        if (isActive())
            pole.setTargetValue (coefficient);
        else
        {
            pole.setCurrentAndTargetValue (coefficient);
            integrator = 0.0;
        }

        if (decibels != targetDb)
        {
            targetDb = decibels;
            boost.setTargetValue (juce::Decibels::decibelsToGain ((double) decibels) - 1.0);
        }
    }

    void bypass() noexcept
    {
        targetDb = 0.0f;
        boost.setCurrentAndTargetValue (0.0);
        integrator = 0.0;
    }

    bool isActive() const noexcept { return boost.isSmoothing() || boost.getCurrentValue() != 0.0; }

    // Add only the shelf's high-pass contribution to the existing wet+dry mix.
    float extra (float wet) noexcept
    {
        const auto v = ((double) wet - integrator) * pole.getNextValue();
        const auto low = integrator + v;
        integrator = low + v;
        return (float) (((double) wet - low) * boost.getNextValue());
    }

private:
    std::array<double, frequenciesKHz.size()> poles {};
    juce::LinearSmoothedValue<double> pole, boost;
    double integrator = 0.0;
    float targetDb = 0.0f;
};
}
