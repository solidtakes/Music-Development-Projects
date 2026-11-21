cmake_minimum_required(VERSION 3.22)

# Must be set before project() to take effect.
if(APPLE)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "10.13" CACHE STRING "Minimum macOS version")
    set(CMAKE_OSX_ARCHITECTURES "x86_64;arm64" CACHE STRING "macOS architectures")
endif()

project(LPCVoiceLab VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Build type" FORCE)
endif()

#-------------------------------------------------------------------------------
# JUCE
#
# Fetched rather than vendored so the repository carries no framework source.
# Set JUCE_SOURCE_DIR to point at a local checkout and skip the download.
#-------------------------------------------------------------------------------
set(JUCE_TAG "8.0.15" CACHE STRING "JUCE git tag to build against")
set(JUCE_SOURCE_DIR "" CACHE PATH "Optional path to an existing JUCE checkout")

if(JUCE_SOURCE_DIR)
    add_subdirectory(${JUCE_SOURCE_DIR} ${CMAKE_BINARY_DIR}/JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG        ${JUCE_TAG}
        GIT_SHALLOW    TRUE)
    FetchContent_MakeAvailable(JUCE)
endif()

#-------------------------------------------------------------------------------
# Plugin
#
# VST2 is deliberately absent: the Steinberg VST 2.4 SDK is no longer obtainable
# and binaries built against it cannot be distributed without a licence issued
# before October 2018. VST3 and AU cover the same hosts on both platforms.
#-------------------------------------------------------------------------------
# No Standalone target. The algorithm needs two different signals on its two
# input channels, voice on one and synth on the other, which an app taking a
# default input device cannot sensibly supply: a mono input leaves the carrier
# channel silent and produces no output at all.
set(TBX_FORMATS VST3)
if(APPLE)
    list(APPEND TBX_FORMATS AU)
endif()

juce_add_plugin(LPCVoiceLab
    PRODUCT_NAME                "LPC Voice Lab"
    COMPANY_NAME                "solidtakes"
    BUNDLE_ID                   "com.solidtakes.lpcvoicelab"
    PLUGIN_MANUFACTURER_CODE    Sltk
    PLUGIN_CODE                 Lpvc
    FORMATS                     ${TBX_FORMATS}
    VST3_CATEGORIES             "Fx" "Modulation"
    AU_MAIN_TYPE                kAudioUnitType_Effect
    IS_SYNTH                    FALSE
    NEEDS_MIDI_INPUT            FALSE
    NEEDS_MIDI_OUTPUT           FALSE
    IS_MIDI_EFFECT              FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD     FALSE)

target_sources(LPCVoiceLab PRIVATE
    Source/PluginProcessor.cpp
    Source/TalkBoxCore.cpp)

target_compile_definitions(LPCVoiceLab PUBLIC
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_DISPLAY_SPLASH_SCREEN=0
    JUCE_REPORT_APP_USAGE=0)

target_link_libraries(LPCVoiceLab PRIVATE
    juce::juce_audio_utils
    PUBLIC
    juce::juce_recommended_config_flags
    juce::juce_recommended_lto_flags
    juce::juce_recommended_warning_flags)

#-------------------------------------------------------------------------------
# DSP smoke test: builds the signal path with no JUCE and checks the invariants
# that matter (bypass fidelity, latency, unvoiced substitution, low end gain).
#-------------------------------------------------------------------------------
option(TBX_BUILD_TESTS "Build the DSP smoke test" ON)

if(TBX_BUILD_TESTS)
    enable_testing()
    add_executable(tbx_tests Tests/TalkBoxCoreTests.cpp Source/TalkBoxCore.cpp)
    target_include_directories(tbx_tests PRIVATE Source)
    add_test(NAME tbx_tests COMMAND tbx_tests)
endif()
